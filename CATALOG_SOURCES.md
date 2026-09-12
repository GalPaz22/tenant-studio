# איך ה־Studio מקבל קטלוג ציבורי

ה־Studio לא מניח שכל אתר בנוי אותו דבר. הוא בוחר מחבר לפי הפלטפורמה, ואז
מאמת את הנתונים לפני שהם נכנסים לפרופיל החיפוש.

## WooCommerce

1. קורא את כתובת האתר כדי לוודא שהדומיין זמין.
2. מנסה את ה־Store API הציבורי:
   `/wp-json/wc/store/v1/products?per_page=100&page=N`
3. מעביר רק שדות מוצר ציבוריים: מזהה, שם, URL, תמונה, מחיר, מלאי,
   קטגוריות ותגיות.
4. עוצר במדגם של 500 מוצרים בגרסת ה־Studio. סנכרון מלא ידרוש מחבר מורשה,
   webhook או feed.

## Shopify

ה־Studio מנסה את:

`/products.json?limit=100&page=N`

הוא ממפה את `product_type`, `tags`, הווריאציות, המחיר והמלאי לסכמת המוצר
המשותפת. Shopify שמגביל את ה־endpoint או מסתיר מוצרים דורש Storefront API או
חיבור OAuth כדי לקבל קטלוג מלא.

## Magento

אין endpoint ציבורי אמין שאפשר להניח שיהיה פתוח. בגרסה הראשונית ה־Studio
קורא Product JSON-LD מהעמוד שסופק, אם קיים. להפעלה מלאה צריך לבחור אחת מהאפשרויות:

- Magento REST API עם הרשאה.
- GraphQL ציבורי או token מוגבל לקריאה.
- XML/CSV feed שמספק בעל החנות.
- crawler עם רשימת sitemap מאושרת.

## Custom

ה־Studio קורא JSON-LD מסוג `Product` מהעמוד. זו בדיקת היתכנות בלבד. לאחר מכן
ה־agent צריך לבקש או לזהות feed, sitemap או endpoint יציב; הוא לא אמור להעתיק
HTML מלא לכל מוצר או להסתמך על selector זמני בלי אישור.

## גבולות אבטחה

ה־fetcher מקבל HTTPS בלבד, בודק DNS וחוסם כתובות פנימיות, מגביל redirect-ים,
timeout וגודל תגובה. תוכן האתר הוא data בלבד; הוא אינו יכול להורות ל־agent
להריץ קוד, לשלוח secrets או לשנות תשתית.

## מה קורה אחרי המדגם

המדגם משמש ליצירת `profile`, `product.schema`, כללי badges ותכנון אינדקס.
לפני הפעלה מחליפים את ה־sample connector ב־sync adapter:

```text
platform connector → normalized product events → tenant processor → Mongo
                                               ↘ index update + badges
```

ה־sync adapter אחראי ל־create/update/delete, pagination, retries, webhook-ים
ו־reconciliation. ה־Search Service קורא את Mongo ואינו סורק אתר בזמן חיפוש.
