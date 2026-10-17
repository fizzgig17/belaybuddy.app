-- Make the API pick up the columns and functions added by the previous
-- migration (its schema cache can lag behind DDL).
notify pgrst, 'reload schema';
