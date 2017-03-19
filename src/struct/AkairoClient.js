const { Client } = require('discord.js');
const CommandHandler = require('./CommandHandler');
const InhibitorHandler = require('./InhibitorHandler');
const ListenerHandler = require('./ListenerHandler');
const ClientUtil = require('../util/ClientUtil');

/**
 * Options used to determine how the framework behaves.
 * @typedef {Object} AkairoOptions
 * @prop {string|string[]} [ownerID=''] - Discord ID of the client owner(s).
 * @prop {boolean} [selfbot=false] - Whether or not this bot is a selfbot.
 * @prop {string} [commandDirectory] - Directory to commands.
 * @prop {string|string[]|Function} [prefix='!'] - Default command prefix(es) or function <code>(message => {})</code> returning prefix(es).
 * @prop {boolean|Function} [allowMention=true] - Whether or not to allow mentions to the client user as a prefix.
 * <br>Can be function <code>(message => {})</code> that returns true or false.
 * @prop {boolean} [handleEdits=false] - Whether or not to handle edited messages.
 * @prop {number} [defaultCooldown=0] - The default cooldown for commands.
 * @prop {PromptOptions} [defaultPrompt] - The default prompt options.
 * @prop {string} [inhibitorDirectory] - Directory to inhibitors.
 * @prop {boolean} [blockNotSelf=true] - Whether or not to block others, if a selfbot.
 * @prop {boolean} [blockClient=true] - Whether or not to block self, if not a selfbot.
 * @prop {boolean} [blockBots=true] - Whether or not to block bots.
 * @prop {string} [listenerDirectory] - Directory to listeners.
 * @prop {Object} [emitters={}] - Emitters to load onto the listener handler.
 */

class AkairoClient extends Client {
    /**
     * The Akairo framework client.
     * <br>Creates the handlers and sets them up.
     * @param {AkairoOptions} [options={}] - Options to use for the framework.
     * @param {ClientOptions} [clientOptions] - Options for Discord JS client.
     * <br>If not specified, the previous options parameter is used instead.
     */
    constructor(options = {}, clientOptions) {
        super(clientOptions || options);

        /**
         * The ID of the owner.
         * @type {string}
         */
        this.ownerID = options.ownerID;

        /**
         * Whether or not this is a selfbot.
         * @type {boolean}
         */
        this.selfbot = !!options.selfbot;

        /**
         * An empty object.
         * <br>Useful for storing things.
         * @name AkairoClient#mem
         * @type {Object}
         */
        this.mem = {};

        /**
         * Utility methods.
         * @type {ClientUtil}
         */
        this.util = new ClientUtil(this);

        /**
         * Databases added.
         * @type {Object}
         */
        this.databases = {};

        /**
         * Options for the framework.
         * @type {AkairoOptions}
         */
        this.akairoOptions = options;
    }

    /**
     * Adds a database that will be initialized once ready.
     * @param {string} name - Name of database.
     * @param {SQLiteHandler} database - The database.
     * @returns {AkairoClient}
     */
    addDatabase(name, database) {
        Object.defineProperty(this.databases, name, {
            value: database,
            enumerable: true
        });

        if (!this.akairoOptions.emitters) this.akairoOptions.emitters = {};
        this.akairoOptions.emitters[name] = database;
        return this;
    }

    /**
     * Logins the client, creates message listener, and init databases.
     * <br>Resolves once client is ready.
     * @param {string} token - Client token.
     * @returns {Promise<void>}
     */
    login(token) {
        return new Promise((resolve, reject) => {
            this.build();
            super.login(token).catch(reject);

            this.once('ready', () => {
                const promises = Object.keys(this.databases).map(key => {
                    const db = this.databases[key];

                    const ids = db.init ? db.init(this) || [] : [];
                    return db.load ? db.load(ids) : Promise.resolve();
                });

                Promise.all(promises).then(() => {
                    if (this.commandHandler) {
                        this.on('message', m => {
                            this.commandHandler.handle(m, false);
                        });

                        if (this.commandHandler.handleEdits) {
                            this.on('messageUpdate', (o, m) => {
                                if (o.content === m.content) return;
                                if (this.commandHandler.handleEdits) this.commandHandler.handle(m, true);
                            });
                        }
                    }

                    return resolve();
                }).catch(reject);
            });
        });
    }

    /**
     * Builds the client by creating the handlers.
     * @returns {void}
     */
    build() {
        if (this.akairoOptions.commandDirectory && !this.commandHandler) {
            /**
             * The command handler.
             * @type {CommandHandler}
             */
            this.commandHandler = new CommandHandler(this, this.akairoOptions);
        }

        if (this.akairoOptions.inhibitorDirectory && !this.inhibitorHandler) {
            /**
             * The inhibitor handler.
             * @type {InhibitorHandler}
             */
            this.inhibitorHandler = new InhibitorHandler(this, this.akairoOptions);
        }

        if (this.akairoOptions.listenerDirectory && !this.listenerHandler) {
            /**
             * The listener handler.
             * @type {ListenerHandler}
             */
            this.listenerHandler = new ListenerHandler(this, this.akairoOptions);
        }
    }
}

module.exports = AkairoClient;
