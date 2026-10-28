alter table merchant
    add column display_name text
    check (display_name is null or (char_length(display_name) > 0 and char_length(display_name) <= 120));
