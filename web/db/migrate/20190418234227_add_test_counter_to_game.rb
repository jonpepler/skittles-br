class AddTestCounterToGame < ActiveRecord::Migration[5.2]
  def change
    add_column :games, :test_counter, :integer
  end
end
