class ChangeActiveStorageAttachmentsRecordIdToUuid < ActiveRecord::Migration[5.2]
  def up
    remove_record_id_index!

    # Rename the built-in record_id:int column and allow NULL values.
    rename_column :active_storage_attachments, :record_id, :record_id_int
    change_column_null :active_storage_attachments, :record_id_int, true

    # Rename our (now populated) UUID column to `record_id` and prevent NULL values.
    rename_column :active_storage_attachments, :record_uuid, :record_id
    change_column_null :active_storage_attachments, :record_id, false

    add_record_id_index!
  end

  def down
    remove_record_id_index!

    # Rename our UUID column back to `record_uuid` and once again allow NULL values.
    rename_column :active_storage_attachments, :record_id, :record_uuid
    change_column_null :active_storage_attachments, :record_uuid, true

    # Rename `record_id_int` back to record_id:int column and prevent NULL values.
    rename_column :active_storage_attachments, :record_id_int, :record_id
    change_column_null :active_storage_attachments, :record_id, false

    add_record_id_index!
  end

  private

  def add_record_id_index!
    add_index :active_storage_attachments, [ :record_type, :record_id, :name, :blob_id ], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  def remove_record_id_index!
    remove_index :active_storage_attachments, column: [ :record_type, :record_id, :name, :blob_id ], name: "index_active_storage_attachments_uniqueness", unique: true
  end
end
