A B Khan & Associates — Full Export
====================================

Included:
- Project source (frontend + Laravel backend)
- .env  → copy to backend/.env  (also at _export/.env and _export/backend.env)
- Database dump → _export/abkhanassociates.sql.gz

Restore database:
  gunzip -c _export/abkhanassociates.sql.gz | mysql -u USER -p DATABASE_NAME

Then:
  cd backend && composer install
  php artisan storage:link
  php artisan migrate --force   # only if needed; dump already has schema+data
  cd .. && npm install && npm run build

DB from this export:
  DB_DATABASE=abkhanassociates
  DB_USERNAME=abkhan
  (password is in .env)
