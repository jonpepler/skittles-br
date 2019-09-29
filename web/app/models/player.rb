require 'open-uri'
include Rails.application.routes.url_helpers
class Player < ApplicationRecord
  devise :database_authenticatable, :rememberable
  belongs_to :game, optional: true
  has_one_attached :flag

  def leave_current_game
    game_id = self.game
    self.game = nil
    self.flag.purge
    self.save
    return game_id
  end

  def get_flag
    flag_image = open("http://flag-generator:3002/random-flag")
    self.flag.attach(io: flag_image, filename: "flag.svg", content_type: "image/svg+xml")
  end

  def update_skittles(skittles)
    id_string = "game:#{self.game.id}:#{self.id}"
    $redis.set(id_string, skittles.to_json)
  end

  def get_skittles
    JSON.parse($redis.get("game:#{self.game.id}:#{self.id}") || '{"purple": 0, "yellow": 0, "green": 0, "orange": 0}')
  end

  def info
    flag = nil
    flag = rails_blob_path(self.flag, only_path: true) if self.flag.attached?
    {
      name: self.email, # Generate a fake name + ID!
      pid: self.id,
      skittles: self.get_skittles,
      flag: flag
    }
  end
end
