class RemoveGameRefFromPlayer < ActiveRecord::Migration[5.2]
  def change
    remove_column :players, :game_id
  end
end
