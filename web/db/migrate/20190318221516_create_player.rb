class CreatePlayer < ActiveRecord::Migration[5.2]
  def change
    create_table :players, id: :uuid do |t|
      t.references :game, foreign_key: true
    end
  end
end
