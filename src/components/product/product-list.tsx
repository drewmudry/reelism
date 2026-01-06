"use client";

import { useState, useEffect } from "react";
import { getProducts } from "@/actions/products";
import { Loader2 } from "lucide-react";
import { ProductListModal } from "./product-list-modal";

interface Product {
  id: string;
  type: "external" | "custom";
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  images: string[];
  hooks?: string[];
  ctas?: string[];
  parsed: boolean;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to load products");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Expose refresh function for parent components
  useEffect(() => {
    // Listen for custom event to refresh products
    const handleRefresh = () => {
      fetchProducts();
    };
    window.addEventListener("productAdded", handleRefresh);
    return () => window.removeEventListener("productAdded", handleRefresh);
  }, []);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleClose = () => {
    setSelectedProduct(null);
  };

  const handleProductUpdated = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setSelectedProduct(updatedProduct);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
        Error: {error}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground mb-4">No products yet</p>
        <p className="text-sm text-muted-foreground">
          Add a product via URL or manually to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => handleProductClick(product)}
            className="group relative cursor-pointer border rounded-lg p-4 space-y-3 hover:shadow-md transition-all"
          >
            {product.images && product.images.length > 0 && (
              <div className="aspect-square rounded-md overflow-hidden bg-muted">
                <img
                  src={product.images[0]}
                  alt={product.title || "Product"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            )}

            <div className="space-y-1">
              <h3 className="font-semibold line-clamp-2">
                {product.title || "Untitled Product"}
              </h3>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}
              {product.price !== null && (
                <p className="text-sm font-medium">
                  ${product.price.toFixed(2)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`px-2 py-1 rounded ${
                  product.type === "external"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                }`}
              >
                {product.type === "external" ? "External" : "Custom"}
              </span>
              {!product.parsed && !product.error && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  Parsing...
                </span>
              )}
              {product.error && (
                <span className="text-destructive">Error</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <ProductListModal
          product={selectedProduct}
          onClose={handleClose}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </>
  );
}
