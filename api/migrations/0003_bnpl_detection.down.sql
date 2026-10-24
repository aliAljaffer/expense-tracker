update merchant
set is_bnpl = false
where canonical_name ~* '\y(TABBY|TAMARA|POSTPAY|SPOTII|CASHEW|BUYFIRST)\y';
