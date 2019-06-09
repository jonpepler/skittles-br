class Game < ApplicationRecord
  has_many :players

  def self.with_players
    includes(:players).where.not(players: { id: nil })
  end

  def self.without_players
    includes(:players).where(players: { id: nil })
  end
end
