alter table user_decision drop constraint user_decision_kind_check;

alter table user_decision add constraint user_decision_kind_check check (kind in (
    'transfer_match', 'merchant_merge', 'category_override', 'shared_expense',
    'card_coverage', 'recurring', 'bnpl', 'salary_trend', 'transfer_matches'
));
