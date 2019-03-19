class AddGameRefToPlayer < ActiveRecord::Migration[5.2]
  def change
    add_column :players, :game_id, :uuid
  end
end
