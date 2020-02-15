class StartGameJob < ApplicationJob
  queue_as :default
 
  def perform(game)
    game.update({ status: "starting" })
    game.update_matchmaking_status
  end
end