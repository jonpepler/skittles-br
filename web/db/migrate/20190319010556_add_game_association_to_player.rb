class AddGameAssociationToPlayer < ActiveRecord::Migration[5.2]
  def change
    add_reference :players, :game, type: :uuid, foreign_key: true
  end
end
