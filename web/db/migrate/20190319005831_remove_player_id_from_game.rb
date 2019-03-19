class RemovePlayerIdFromGame < ActiveRecord::Migration[5.2]
  def change
    remove_column :games, :player_id
  end
end
