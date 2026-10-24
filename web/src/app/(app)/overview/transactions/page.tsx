import type { Metadata } from "next";
import { Suspense } from "react";
import { TransactionsList } from "@/components/features/overview/TransactionsList";
import TransactionsLoading from "./loading";
import TransactionsError from "./error";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

interface TransactionsPageProps {
  searchParams: Promise<{
    month?: string;
    bucket?: string;
    account?: string;
    merchant?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  }>;
}

export default async function TransactionsPage(props: TransactionsPageProps) {
  const searchParams = await props.searchParams;

  return (
    <div className="transactions-page">
      <div className="overview-section">
        <h1 className="transactions-page__title">Transactions</h1>
        {searchParams.month && (
          <p className="transactions-page__lede">
            {searchParams.bucket && `${searchParams.bucket} for `}{searchParams.month}
          </p>
        )}
        {searchParams.merchant && (
          <p className="transactions-page__lede">
            Merchant filter {searchParams.from && `from ${searchParams.from}`} {searchParams.to && `to ${searchParams.to}`}
          </p>
        )}
      </div>

      <Suspense fallback={<TransactionsLoading />} fallback-error={<TransactionsError error={new Error("Failed to load transactions")} reset={() => {}} />}>
        <TransactionsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
