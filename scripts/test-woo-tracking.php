<?php
// php scripts/test-woo-tracking.php — standalone hook/queue regression, no WP.
define('ABSPATH', __DIR__);
define('SEMANTIX_API_BASE', 'https://api.example');
define('SEMANTIX_SITE_KEY', 'public-site-key');
$options = array(); $events = array(); $scheduled = array(); $hooks = array(); $response_status = 503;
function add_action($name, $callback, $priority = 10, $args = 1) { $GLOBALS['hooks'][$name] = $callback; }
function get_option($key, $default = false) { return $GLOBALS['options'][$key] ?? $default; }
function add_option($key, $value, $unused = '', $autoload = false) { if (array_key_exists($key, $GLOBALS['options'])) return false; $GLOBALS['options'][$key] = $value; return true; }
function update_option($key, $value, $unused = false) { $GLOBALS['options'][$key] = $value; }
function delete_option($key) { unset($GLOBALS['options'][$key]); }
function sanitize_text_field($value) { return strip_tags($value); }
function wp_unslash($value) { return $value; }
function absint($value) { return abs((int) $value); }
function home_url($value) { return 'https://store.example/'; }
function wp_generate_uuid4() { static $n = 0; return 'cart-' . ++$n; }
function wp_json_encode($value) { return json_encode($value); }
function wp_schedule_single_event($time, $hook, $args) { $GLOBALS['scheduled'][] = array($time, $hook, $args); }
function wp_remote_post($url, $args) { $GLOBALS['events'][] = json_decode($args['body'], true)['document']; return array('status' => $GLOBALS['response_status']); }
function is_wp_error($response) { return false; }
function wp_remote_retrieve_response_code($response) { return $response['status']; }
function get_woocommerce_currency() { return 'ILS'; }
function wc_get_order($id) { return $GLOBALS['order']; }
function wc_get_product($id) { return new TestProduct(); }
class TestProduct { function get_name() { return 'Cup'; } function get_price() { return '10'; } }
class TestItem {
    function get_product_id() { return 7; } function get_variation_id() { return 71; }
    function get_name() { return 'Cup'; } function get_quantity() { return 2; }
}
class WC_Order {
    public $meta = array(); public $paid = false;
    function get_meta($key) { return $this->meta[$key] ?? ''; }
    function update_meta_data($key, $value) { $this->meta[$key] = $value; }
    function is_paid() { return $this->paid; } function get_id() { return 99; }
    function get_items() { return array(new TestItem()); } function get_item_total($item, $tax) { return 10; }
    function get_total() { return 25; } function get_currency() { return 'ILS'; } function save() {}
}
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
require dirname(__DIR__) . '/core/woo-tracking.php';
$_COOKIE = array('semantix_sid' => 'vis-original-12345678', 'semantix_last_query' => 'cup', 'semantix_ab_current' => '{"semantix_takeover":"native"}');
$order = new WC_Order();
semantix_tracking_attach_order($order);
check(isset($hooks['woocommerce_store_api_checkout_update_order_from_request']), 'Store API hook registered');
check($order->meta['_semantix_context']['session_id'] === 'vis-original-12345678', 'Classic checkout captures session');
$block = new WC_Order(); call_user_func($hooks['woocommerce_store_api_checkout_update_order_from_request'], $block, null);
check($block->meta === $order->meta, 'Block checkout captures same context');
semantix_tracking_cart('cart-key', 7, 2, 71);
semantix_tracking_cart('cart-key', 7, 2, 71);
check(count($scheduled) === 2, 'Two successful adds are two independent events');
semantix_tracking_send('cart-1');
$expected_product_id = (defined('SEMANTIX_PRODUCT_ID_PREFIX') ? SEMANTIX_PRODUCT_ID_PREFIX : 'woo_product_') . '7';
check($events[0]['product_id'] === $expected_product_id && $events[0]['variant_id'] === '71', 'Variation keeps parent catalog ID');
if (defined('SEMANTIX_SHADOW_MODE') && SEMANTIX_SHADOW_MODE) check($events[0]['measurement_mode'] === 'shadow', 'Shadow commerce event is labelled as measurement only');
check($events[0]['ab_tests']['semantix_takeover'] === 'native', 'Native A/B arm retained');
check(get_option('semantix_event_cart-1')['attempt'] === 1, 'Failed cart retained for retry');
$response_status = 200; semantix_tracking_send('cart-1');
check($events[0] === $events[1], 'Cart retry retains full identity and timestamp');
check(!get_option('semantix_event_cart-1'), 'Acknowledged cart removed');
semantix_tracking_purchase(99);
check(!get_option('semantix_event_purchase-99'), 'Unpaid order is never a purchase');
$_COOKIE = array('semantix_sid' => 'vis-unrelated-12345678', 'semantix_last_query' => 'wrong');
semantix_tracking_attach_order($order);
check($order->meta['_semantix_context']['search_query'] === 'cup', 'Payment retry cannot overwrite order attribution');
$order->paid = true; semantix_tracking_purchase(99); semantix_tracking_purchase(99);
check(get_option('semantix_event_purchase-99')['document']['session_id'] === 'vis-original-12345678', 'Webhook uses order context');
check(get_option('semantix_event_purchase-99')['document']['line_items'][0]['product_id'] === $expected_product_id, 'Purchase keeps the same catalog ID scheme as carts');
$response_status = 503; semantix_tracking_send('purchase-99');
check(!$order->get_meta('_semantix_reported'), 'Do not mark purchase before successful delivery');
$response_status = 200; semantix_tracking_send('purchase-99');
check($order->get_meta('_semantix_reported') === 'purchase-99', 'Mark purchase after acknowledgement');
$before = count($scheduled); semantix_tracking_purchase(99);
check(count($scheduled) === $before, 'Repeated completion after acknowledgement is deduplicated');
$order = new WC_Order(); $order->paid = true; $_COOKIE = array(); semantix_tracking_purchase(99);
check(get_option('semantix_event_purchase-99')['document']['session_id'] === null, 'Legacy order never borrows callback identity');
$_COOKIE = array('semantix_sid' => array('invalid'));
check(semantix_tracking_context()['session_id'] === null, 'Invalid cookies cannot create attribution');
echo "WooCommerce server regression passed\n";
