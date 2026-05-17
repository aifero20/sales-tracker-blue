-- Trigger: mencegah UPDATE pada transaction_items setelah tersimpan
CREATE OR REPLACE FUNCTION public.prevent_transaction_items_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'transaction_items tidak boleh diubah setelah tersimpan. Hapus dan buat transaksi baru jika perlu koreksi.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lock_transaction_items
BEFORE UPDATE ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_items_update();

-- Trigger: mencegah UPDATE pada sales_transactions setelah tersimpan
-- (kecuali kolom photo_url yang bisa diupdate oleh sync background)
CREATE OR REPLACE FUNCTION public.prevent_sales_transactions_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Izinkan update photo_url saja (dari sync background)
  IF NEW.total_amount <> OLD.total_amount
    OR NEW.store_id <> OLD.store_id
    OR NEW.transaction_date <> OLD.transaction_date
    OR NEW.transaction_time <> OLD.transaction_time
  THEN
    RAISE EXCEPTION 'sales_transactions tidak boleh diubah setelah tersimpan.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lock_sales_transactions
BEFORE UPDATE ON public.sales_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_sales_transactions_update();
