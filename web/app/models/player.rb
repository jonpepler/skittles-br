class Player < ApplicationRecord
  devise :database_authenticatable, :rememberable
  belongs_to :game, optional: true
end
