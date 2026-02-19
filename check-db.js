const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://salessuite_app:mon0715@72.61.17.146:5432/salessuite'
});

async function check() {
    try {
        const res = await pool.query('SELECT * FROM order_items LIMIT 10');
        console.log('Order Items:', JSON.stringify(res.rows, null, 2));
        const orders = await pool.query('SELECT id, order_number FROM orders LIMIT 10');
        console.log('Orders:', JSON.stringify(orders.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
