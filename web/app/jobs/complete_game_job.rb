class CompleteGameJob < ApplicationJob
  queue_as :default
 
  def perform(game)
    game.update({ status: "complete" })
    game.update_matchmaking_status
  end
end