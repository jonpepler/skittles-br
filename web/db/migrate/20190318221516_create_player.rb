class CreatePlayer < ActiveRecord::Migration[5.2]
  def change
    create_table :players, id: :uuid do |t|
    end
  end
end
