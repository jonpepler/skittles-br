# https://gist.github.com/kylefox/00c3d9ca56df78282696ef6bfef5b2f4
class AddRecordUuidToActiveStorageAttachments < ActiveRecord::Migration[5.2]
  def change
    add_column :active_storage_attachments, :record_uuid, :uuid
  end
end
