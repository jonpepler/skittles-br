class CreateGame < ActiveRecord::Migration[5.2]
  def change
    create_table :games, id: :uuid do |t|
      t.references :player, type: :uuid, foreign_key: true
    end
  end
end
