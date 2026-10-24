update merchant
set is_bnpl = true
where is_bnpl = false
  and (
    canonical_name ~* '\y(TABBY|TAMARA|POSTPAY|SPOTII|CASHEW|BUYFIRST)\y'
  );
