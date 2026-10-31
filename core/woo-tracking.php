<?php
if (!defined('ABSPATH')) exit;

// Server events are queued independently of the shopper's response. Each retry
// sends the original event ID and timestamp. No billing/customer data is sent.
function semantix_tracking_options() {
    $options = get_option('semantix_tracking_options', array());
    return array_merge(array('api_base' => SEMANTIX_API_BASE, 'api_key' => SEMANTIX_SITE_KEY), is_array($options) ? $options : array());
}
function semantix_tracking_cookie($name) {
    return isset($_COOKIE[$name]) && is_string($_COOKIE[$name]) ? sanitize_text_field(wp_unslash($_COOKIE[$name])) : '';
}
function semantix_tracking_product_id($id) {
    return (defined('SEMANTIX_PRODUCT_ID_PREFIX') ? SEMANTIX_PRODUCT_ID_PREFIX : 'woo_product_') . absint($id);
}
function semantix_tracking_context() {
    $sid = semantix_tracking_cookie('semantix_sid');
    // Cookie lifetime is the session boundary; do not resurrect expired browser
    // sessions from Woo's longer-lived cart session.
    if (!preg_match('/^vis-[A-Za-z0-9_-]{8,180}$/', $sid)) return array('session_id' => null, 'search_query' => null);
    $query = substr(semantix_tracking_cookie('semantix_last_query'), 0, 500);
    $groups = json_decode(semantix_tracking_cookie('semantix_ab_current'), true);
    $context = array('session_id' => $sid, 'search_query' => $query ?: null);
    if (is_array($groups)) {
        $safe = array();
        foreach (array_slice($groups, 0, 20, true) as $key => $value) {
            if (is_string($value) && preg_match('/^[\w:-]{1,100}$/', $key) && preg_match('/^[\w:-]{1,100}$/', $value)) $safe[$key] = $value;
        }
        if ($safe) $context['ab_tests'] = $safe;
    }
    return $context;
}
function semantix_tracking_schedule($id, $delay = 0) {
    if (function_exists('as_schedule_single_action')) {
        as_schedule_single_action(time() + max(1, $delay), 'semantix_send_event', array($id), 'semantix');
    } else {
        wp_schedule_single_event(time() + max(1, $delay), 'semantix_send_event', array($id));
    }
}
function semantix_tracking_queue($document, $id = '') {
    $options = semantix_tracking_options();
    if (empty($options['api_key'])) return;
    $id = $id ?: wp_generate_uuid4();
    $document = array_merge(array('platform' => 'woocommerce', 'timestamp' => gmdate('c'), 'site_url' => home_url('/')), $document, array('event_id' => $id));
    if (defined('SEMANTIX_SHADOW_MODE') && SEMANTIX_SHADOW_MODE) $document['measurement_mode'] = 'shadow';
    if (add_option('semantix_event_' . $id, array('document' => $document, 'attempt' => 0), '', false)) semantix_tracking_schedule($id);
}
add_action('semantix_send_event', 'semantix_tracking_send', 10, 1);
function semantix_tracking_send($id) {
    if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/', $id)) return;
    $key = 'semantix_event_' . $id;
    $event = get_option($key);
    if (!$event) return;
    $lock = 'semantix_lock_' . $id;
    $locked_at = (int) get_option($lock, 0);
    if ($locked_at && $locked_at < time() - 60) delete_option($lock);
    if (!add_option($lock, time(), '', false)) return;
    try {
        $options = semantix_tracking_options();
        $response = wp_remote_post(rtrim($options['api_base'], '/') . '/search-to-cart', array(
            'timeout' => 10, 'headers' => array('Content-Type' => 'application/json', 'X-API-Key' => $options['api_key']),
            'body' => wp_json_encode(array('document' => $event['document'])),
        ));
        $status = is_wp_error($response) ? 0 : wp_remote_retrieve_response_code($response);
        if ($status >= 200 && $status < 300) {
            if ($event['document']['event_type'] === 'checkout_completed') {
                $order = wc_get_order($event['document']['order_id']);
                if ($order) { $order->update_meta_data('_semantix_reported', $id); $order->save(); }
            }
            delete_option($key);
        } else {
            $event['attempt']++;
            $event['last_status'] = $status;
            update_option($key, $event, false);
            // Retain failed events for manual recovery; cap automatic retries.
            if ($event['attempt'] < 8) semantix_tracking_schedule($id, min(21600, 60 * pow(2, $event['attempt'])));
        }
    } finally { delete_option($lock); }
}
add_action('woocommerce_add_to_cart', 'semantix_tracking_cart', 20, 6);
function semantix_tracking_cart($cart_item_key, $product_id, $quantity, $variation_id = 0, $variation = array(), $cart_item_data = array()) {
    $product = wc_get_product($variation_id ?: $product_id);
    semantix_tracking_queue(array_merge(semantix_tracking_context(), array(
        'event_type' => 'add_to_cart', 'source' => 'woocommerce_add_to_cart',
        'product_id' => semantix_tracking_product_id($product_id), 'variant_id' => $variation_id ? (string) $variation_id : null,
        'product_name' => $product ? $product->get_name() : null, 'quantity' => (float) $quantity,
        'price' => $product ? (float) $product->get_price() : null, 'currency' => get_woocommerce_currency(),
    )));
}
add_action('woocommerce_checkout_create_order', 'semantix_tracking_attach_order', 20, 2);
add_action('woocommerce_store_api_checkout_update_order_from_request', 'semantix_tracking_attach_order', 20, 2);
function semantix_tracking_attach_order($order, $request = null) {
    if (!is_a($order, 'WC_Order') || $order->get_meta('_semantix_context')) return;
    $context = semantix_tracking_context();
    if ($context['session_id']) $order->update_meta_data('_semantix_context', $context);
}
add_action('woocommerce_payment_complete', 'semantix_tracking_purchase', 20, 1);
add_action('woocommerce_order_status_processing', 'semantix_tracking_purchase', 20, 1);
add_action('woocommerce_order_status_completed', 'semantix_tracking_purchase', 20, 1);
add_action('woocommerce_thankyou', 'semantix_tracking_purchase', 20, 1);
function semantix_tracking_purchase($order_id) {
    $order = wc_get_order($order_id);
    if (!$order || !$order->is_paid() || $order->get_meta('_semantix_reported')) return;
    // Payment callbacks use ONLY the context captured on this order, never the
    // browser making the callback (which may be a gateway or another shopper).
    $context = $order->get_meta('_semantix_context');
    if (!is_array($context)) $context = array('session_id' => null, 'search_query' => null);
    $items = array();
    foreach ($order->get_items() as $item) {
        $items[] = array('product_id' => semantix_tracking_product_id($item->get_product_id()),
            'variant_id' => $item->get_variation_id() ? (string) $item->get_variation_id() : null,
            'name' => $item->get_name(), 'quantity' => $item->get_quantity(), 'price' => (float) $order->get_item_total($item, false));
    }
    semantix_tracking_queue(array_merge($context, array(
        'event_type' => 'checkout_completed', 'source' => 'woocommerce_paid_order',
        'order_id' => (string) $order->get_id(), 'total_price' => (float) $order->get_total(),
        'currency' => $order->get_currency(), 'line_items' => $items,
    )), 'purchase-' . $order->get_id());
}

// Configure a generic package or override a store-specific export without editing JS.
add_action('admin_init', function () {
    register_setting('semantix_tracking', 'semantix_tracking_options', array('sanitize_callback' => function ($value) {
        $base = isset($value['api_base']) && is_string($value['api_base']) ? esc_url_raw(rtrim($value['api_base'], '/'), array('https')) : '';
        $key = isset($value['api_key']) && is_string($value['api_key']) ? trim($value['api_key']) : '';
        if (!$base || !preg_match('/^[A-Za-z0-9_-]{8,128}$/', $key)) {
            add_settings_error('semantix_tracking', 'invalid', 'Enter an HTTPS search server and the public site key.');
            return semantix_tracking_options();
        }
        return array('api_base' => $base, 'api_key' => $key);
    }));
});
add_action('admin_menu', function () {
    $label = defined('SEMANTIX_SHADOW_MODE') && SEMANTIX_SHADOW_MODE ? 'Semantix Shadow' : 'Semantix Search';
    add_options_page($label, $label, 'manage_options', 'semantix-search', function () use ($label) {
        if (!current_user_can('manage_options')) return;
        $options = semantix_tracking_options();
        echo '<div class="wrap"><h1>' . esc_html($label) . '</h1><p>Session tracking: product clicks, successful carts and paid orders. Session expires after 30 minutes of inactivity.</p><form method="post" action="options.php">';
        settings_fields('semantix_tracking'); settings_errors('semantix_tracking');
        echo '<p><label>Search server <input type="url" size="60" name="semantix_tracking_options[api_base]" value="' . esc_attr($options['api_base']) . '"></label></p>';
        echo '<p><label>Public site key <input type="text" size="60" name="semantix_tracking_options[api_key]" value="' . esc_attr($options['api_key']) . '"></label></p>';
        submit_button(); echo '</form></div>';
    });
});
