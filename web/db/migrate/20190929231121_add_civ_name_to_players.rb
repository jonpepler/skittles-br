class AddCivNameToPlayers < ActiveRecord::Migration[5.2]
  def change
    add_column :players, :civ_name, :string
  end
end
