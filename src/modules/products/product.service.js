import { query } from '../../config/db.js';

export const productService = {
  async getAllProducts() {
    const sql = `
      SELECT 
        p.id, p.name, p.description, p.price, p.image_url,
        COALESCE(
          (
            SELECT json_agg(v) FROM (
              SELECT pv.id, pv.size, pv.stock_quantity 
              FROM product_variants pv 
              WHERE pv.product_id = p.id
              ORDER BY CASE pv.size 
                WHEN 'S' THEN 1 
                WHEN 'M' THEN 2 
                WHEN 'L' THEN 3 
                ELSE 4 
              END
            ) v
          ),
          '[]'
        ) as variants
      FROM products p
      WHERE p.is_active = true
      GROUP BY p.id
    `;
    const result = await query(sql);
    return result.rows;
  },

  async getProductById(id) {
    const sql = `
      SELECT 
        p.id, p.name, p.description, p.price, p.image_url,
        COALESCE(
          (
            SELECT json_agg(v) FROM (
              SELECT pv.id, pv.size, pv.stock_quantity 
              FROM product_variants pv 
              WHERE pv.product_id = p.id
              ORDER BY CASE pv.size 
                WHEN 'S' THEN 1 
                WHEN 'M' THEN 2 
                WHEN 'L' THEN 3 
                ELSE 4 
              END
            ) v
          ),
          '[]'
        ) as variants
      FROM products p
      WHERE p.id = $1 AND p.is_active = true
      GROUP BY p.id
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }
};
