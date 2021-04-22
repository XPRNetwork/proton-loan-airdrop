#include <rewards/rewards.hpp>

namespace proton {
void rewards::on_transfer(const name& from, const name& to,
                          const asset& quantity, const string& memo) {
  check(from == get_self() || to == get_self(), "not involved in transfer");

  // Skip if outgoing
  if (from == get_self()) {
    return;
  }

  // Skip if deposit from system accounts
  if (from == "eosio.stake"_n || from == "eosio.ram"_n || from == "eosio"_n) {
    return;
  }

  // Validate transfer
  check(to == get_self(), "invalid to account");

  // Deposit
  name token_contract = get_first_receiver();
  auto token = extended_asset(quantity, token_contract);

  std::string trimmed_memo = memo;
  trim(trimmed_memo);
  if (starts_with(trimmed_memo, "deposit rewards")) {
    deposit_rewards(token);
  } else {
    deposit_stake(from, token);
  }
}

} // namespace proton