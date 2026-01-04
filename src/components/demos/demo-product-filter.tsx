"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProducts } from "@/actions/products";
import { Loader2 } from "lucide-react";

type Product = {
  id: string;
  title: string | null;
};

export function DemoProductFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedProductId = searchParams.get("productId") || "";

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const userProducts = await getProducts();
        setProducts(userProducts);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleProductChange = (productId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (productId) {
      params.set("productId", productId);
    } else {
      params.delete("productId");
    }

    router.push(`/app/demos?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading products...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-filter" className="text-sm font-medium">
        Filter by product:
      </label>
      <select
        id="product-filter"
        value={selectedProductId}
        onChange={(e) => handleProductChange(e.target.value)}
        className="px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
      >
        <option value="">All demos</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.title || "Untitled Product"}
          </option>
        ))}
      </select>
    </div>
  );
}

