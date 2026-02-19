const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://salessuite_app:mon0715@72.61.17.146:5432/salessuite'
});

async function check() {
    try {
        const orders = await pool.query('SELECT id, order_number, total_amount, (SELECT count(*) FROM order_items WHERE order_id = orders.id) as item_count FROM orders WHERE order_number = \'ORD-20260216-0003\'');
        console.log('Orders with number ORD-20260216-0003:', JSON.stringify(orders.rows, null, 2));

        if (orders.rows.length > 0) {
            const orderId = orders.rows[0].id;
            const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
            console.log('Items for first found order:', JSON.stringify(items.rows, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
