exports.up = (knex) => knex.schema.createTable('users', (t) => {
  t.increments('id');
  t.string('email').notNullable().unique();
});
exports.down = (knex) => knex.schema.dropTable('users');
