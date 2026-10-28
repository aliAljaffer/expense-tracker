update transaction
set posted_time = substring(
    description_raw from '(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9])'
)::time
where posted_time = '00:00'
  and description_raw ~ 'Time:([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]';
