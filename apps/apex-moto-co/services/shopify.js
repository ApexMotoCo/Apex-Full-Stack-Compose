const axios = require('axios');

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'apexapparelsupply.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-01';

if (!SHOPIFY_ACCESS_TOKEN) {
  console.warn('⚠️  SHOPIFY_ACCESS_TOKEN not configured. Shopify integration disabled.');
}

const shopifyClient = axios.create({
  baseURL: `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}`,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch all products from Shopify store
 */
async function getAllProducts() {
  try {
    if (!SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Shopify access token not configured');
    }

    const response = await shopifyClient.get('/graphql.json', {
      data: {
        query: `
          {
            products(first: 250) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  vendor
                  productType
                  images(first: 1) {
                    edges {
                      node {
                        src
                        altText
                      }
                    }
                  }
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
                        availableForSale
                        inventory {
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `
      }
    });

    return response.data.data.products.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error fetching Shopify products:', error.message);
    throw error;
  }
}

/**
 * Fetch a single product by handle
 */
async function getProductByHandle(handle) {
  try {
    if (!SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Shopify access token not configured');
    }

    const response = await shopifyClient.post('/graphql.json', {
      query: `
        {
          productByHandle(handle: "${handle}") {
            id
            title
            handle
            description
            vendor
            productType
            images(first: 10) {
              edges {
                node {
                  src
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  availableForSale
                }
              }
            }
          }
        }
      `
    });

    return response.data.data.productByHandle;
  } catch (error) {
    console.error(`Error fetching product ${handle}:`, error.message);
    throw error;
  }
}

/**
 * Search products by query
 */
async function searchProducts(query) {
  try {
    if (!SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Shopify access token not configured');
    }

    const response = await shopifyClient.post('/graphql.json', {
      query: `
        {
          search(query: "${query}", first: 10, types: PRODUCT) {
            edges {
              node {
                ... on Product {
                  id
                  title
                  handle
                  description
                  images(first: 1) {
                    edges {
                      node {
                        src
                      }
                    }
                  }
                  variants(first: 1) {
                    edges {
                      node {
                        price
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    });

    return response.data.data.search.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error searching products:', error.message);
    throw error;
  }
}

module.exports = {
  getAllProducts,
  getProductByHandle,
  searchProducts,
  SHOPIFY_STORE
};
