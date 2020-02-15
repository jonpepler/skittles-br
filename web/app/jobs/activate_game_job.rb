class ActivateGameJob < ApplicationJob
  queue_as :default
 
  def perform(game)
    game.update({ status: "active" })
    game.update_matchmaking_status
  end
end