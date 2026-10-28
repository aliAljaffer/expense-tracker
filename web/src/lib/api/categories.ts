import type { CategoriesResponse } from "./types";

export async function getCategories(): Promise<CategoriesResponse> {
  const response = await fetch("/api/bff/categories");

  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }

  return response.json();
}

export async function updateTransactionCategory(
  transactionId: number,
  categoryId: number | null,
  applyToMerchant: boolean
): Promise<void> {
  const response = await fetch(`/api/bff/transactions/${transactionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      category_id: categoryId,
      apply_to_merchant: applyToMerchant,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update category");
  }
}
