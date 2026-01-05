"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

type Product = {
  id: string;
  title: string | null;
};

interface DemoProductFilterProps {
  products: Product[];
  selectedProductId: string;
}

export function DemoProductFilter({ products, selectedProductId }: DemoProductFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (products.length === 0) {
    return null;
  }

  const handleProductChange = (productId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (productId) {
      params.set("productId", productId);
    } else {
      params.delete("productId");
    }

    router.push(`/app/demos?${params.toString()}`);
  };

  const showBubbles = products.length <= 7;
  const visibleProducts = showBubbles ? products : products.slice(0, 6);
  const remainingProducts = showBubbles ? [] : products.slice(6);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={selectedProductId === "" ? "default" : "outline"}
        size="sm"
        onClick={() => handleProductChange("")}
        className="h-8"
      >
        All
      </Button>
      
      {visibleProducts.map((product) => {
        const isSelected = selectedProductId === product.id;
        return (
          <Button
            key={product.id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => handleProductChange(product.id)}
            className="h-8"
          >
            {product.title || "Untitled Product"}
          </Button>
        );
      })}

      {!showBubbles && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              More <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {remainingProducts.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <DropdownMenuItem
                  key={product.id}
                  onClick={() => handleProductChange(product.id)}
                  className={isSelected ? "bg-accent" : ""}
                >
                  {product.title || "Untitled Product"}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
