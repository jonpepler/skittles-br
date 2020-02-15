class CompleteGameJob < ApplicationJob
  queue_as :default
 
  def perform(game)
    puts "\n\n!!!!!!!! Running on game #{game.id}\n\n"
    game.update({ status: "complete" })
    game.update_matchmaking_status
  end
end