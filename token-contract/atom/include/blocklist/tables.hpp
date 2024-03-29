#pragma once

#include <eosio/eosio.hpp>

namespace eosio {
struct [[eosio::table, eosio::contract("blocklist")]] blocklists {
    name    account_name;

    uint64_t primary_key() const { return account_name.value; }

    EOSLIB_SERIALIZE(blocklists, (account_name))
};
typedef multi_index<name("blocklist"_n), blocklists> blocklist_table;

}
