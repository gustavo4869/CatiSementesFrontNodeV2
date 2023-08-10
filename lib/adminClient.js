'use strict';

const adminClient = require('keycloak-admin-client');
const getToken = require('keycloak-request-token');
const request = require('request-promise-native');

class AdminClient {

    constructor(config) {
        this.config = AdminClient.createAdminClientConfig(config);
        this.request = new KeyCloakAdminRequest(this.config);
    }

    static createAdminClientConfig(config) {
        const authServerUrl = `${config.serverUrl}/`;
        return {
            realm: config.realm,
            baseUrl: authServerUrl,
            resource: config.resource,
            username: config.adminLogin,
            password: config.adminPassword,
            grant_type: 'password',
            client_id: config.adminClienId || 'admin-cli'
        };
    }

    realmsList() {
        return adminClient(this.config).then(client => client.realms.find());
    }

    usersList() {
        return adminClient(this.config).then(client => client.users.find(this.config.realm));
    }

    createTestUser() {
        return adminClient(this.config)
            .then(
                client => createTestUser(client, this.config.realm)
                    .then(
                        newUser => resetUserPassword(client, this.config.realm, newUser)
                            .then(
                                () => newUser
                            )
                    )
            );
    }

    createUser(user) {
        return adminClient(this.config)
            .then(
                client => createUser(client, this.config.realm, user)
                    .then(newUser => {
                            resetUserPassword(client, this.config.realm, { id: newUser.id, senha: user.senha })
                                .then(
                                    () => newUser
                                ).catch(
                                    () => false
                                )
                        }).catch(
                            (error) => error
                        )
            ).catch(
                (error) => error
            );
    }

    updateUser(objUser) {
        return adminClient(this.config)
            .then(
                client => this.findUser(objUser.username)
                    .then(
                        user => {
                            let usuario = {
                                id: user.id,
                                username: objUser.username,
                                firstName: objUser.firstName,
                                email: objUser.email,
                                groups: [objUser.clientRoles],
                                attributes: {
                                    CPF: [objUser.cpf],
                                    Telefone: [objUser.telefone],
                                    Cargo: [objUser.cargo],
                                    NomeCompleto: [objUser.nomeCompleto],
                                    Observacoes: [objUser.observacoes],
                                    UnidadeAdministrativa: [objUser.unidadeAdministrativa],
                                    Perfil: [objUser.clientRoles]
                                }                                
                            };
                            objUser.id = user.id;
                            updateUser(client, this.config.realm, usuario);
                        }
                    )
                    .then(user => {
                        if(objUser.senha !== ""){
                            resetUserPassword(client, this.config.realm, { id: objUser.id, senha: objUser.senha })
                                .then(
                                    () => user
                                )
                        }
                    })
            );
    }

    findUser(username) {
        return adminClient(this.config)
            .then(
                client => client.users.find(this.config.realm, {
                    username: username
                })
            )
            .then(
                users => {
                    let user = users && users[0];
                    return user && user.id ? Promise.resolve(user) : Promise.reject('Usuário não encontrado');
                }
            );
    }

    setTestUserCustomerId() {
        return adminClient(this.config)
            .then(
                client => this.findTestUser()
                    .then(
                        user => {
                            user.attributes = user.attributes || {};
                            user.attributes.customerId = 123;
                            return client.users.update(this.config.realm, user)
                                .then(
                                    () => 'customerId added'
                                );
                        }
                    )
            );
    }

    removeTestUserCustomerId() {
        return adminClient(this.config)
            .then(
                client => this.findTestUser()
                    .then(
                        user => {
                            user.attributes = user.attributes || {};
                            user.attributes.customerId = undefined;
                            return client.users.update(this.config.realm, user)
                                .then(() => 'customerId removed');
                        }
                    )
            );
    }

    getUserById() {
        return adminClient(this.config)
            .then(
                client => this.findTestUser()
                    .then(
                        user => client.users.find(this.config.realm, {
                            userId: user.id
                        })
                    )
            );
    }

    deleteTestUser() {
        return adminClient(this.config)
            .then(
                client => this.findTestUser()
            )
            .then(
                user => this.deleteUserById(user.id)
            );
    }

    deleteUserById(userId) {
        return adminClient(this.config)
            .then(
                client => client.users.remove(this.config.realm, userId)
            ).then(
                () => true
            ).catch(
                () => false
            );
    }

    createRole() {
        return this.authenticate()
            .then(
                token => this.request.createRole('TEST_ROLE', token)
            )
            .then(
                () => 'role created'
            );
    }

    deleteRole() {
        return this.authenticate()
            .then(
                token => this.request.deleteRole('TEST_ROLE', token)
            )
            .then(
                () => 'TEST_ROLE role is deleted'
            );
    }

    addRoleToUser(username, roleName) {
        return this.findUser(username)
            .then(
                user => this.authenticate()
                    .then(
                        token => this.getRoleByName(roleName)
                            .then(
                                role => this.request.addRole(user.id, role, token)
                            )
                    ).then(
                        () => true
                    ).catch(
                        () => false
                    )
            );
    }

    removeRoleFromUser(username, roleName) {
        return this.findUser(username)
            .then(
                user => this.authenticate()
                    .then(
                        token => this.getRoleByName(roleName)

                            .then(
                                role => this.request.removeRoleFromUser(user.id, role, token)
                            )
                    )
                    .then(
                        () => true
                    ).catch(
                        () => false
                    )
            );
    }

    getRoleByName(roleName) {
        return this.authenticate()
            .then(
                token => this.request.getRole(roleName, token)
            )
            .then(
                role => role ? Promise.resolve(role) : Promise.reject('role not found')
            );
    }

    authenticate() {
        return getToken(this.config.baseUrl, this.config);
    }

}

function createTestUser(client, realm) {
    return client.users.create(realm, {
        username: 'test_user',
        firstName: 'user first name',
        enabled: true
    });
}

function createUser(client, realm, user){
    return client.users.create(realm, {
        enabled: true,
        username: user.username,
        firstName: user.firstName,
        email: user.email,
        groups: [user.clientRoles],
        attributes: {
            CPF: [user.cpf],
            Telefone: [user.telefone],
            Cargo: [user.cargo],
            NomeCompleto: [user.nomeCompleto],
            Observacoes: [user.observacoes],
            UnidadeAdministrativa: [user.unidadeAdministrativa],
            Perfil: [user.clientRoles]
        }
    })
}

function updateUser(client, realm, user){
    return client.users.update(realm, user)
}

function resetUserPassword(client, realm, user) {
    return client.users.resetPassword(realm, user.id, {
        type: 'password',
        value: user.senha
    });
}

class KeyCloakAdminRequest {

    constructor(config) {
        this.config = config;
    }

    addRole(userId, role, token) {
        return this.doRequest('POST',
            `/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`, token, [role]);
    }

    createRole(roleName, token) {
        return this.doRequest('POST',
            `/admin/realms/${this.config.realm}/roles`, token, {
                name: roleName
            });
    }

    deleteRole(roleName, token) {
        return this.doRequest('DELETE',
            `/admin/realms/${this.config.realm}/roles/${roleName}`, token);
    }

    getRole(roleName, token) {
        return this.doRequest('GET',
            `/admin/realms/${this.config.realm}/roles/${roleName}`, token, null);
    }

    removeRoleFromUser(userId, role, token) {
        return this.doRequest('DELETE',
            `/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`, token, [role]);
    }

    doRequest(method, url, accessToken, jsonBody) {
        let options = {
            url: this.config.baseUrl + url,
            auth: {
                bearer: accessToken
            },
            method: method,
            json: true
        };

        if (jsonBody !== null) {
            options.body = jsonBody;
        }

        return request(options).catch(error => Promise.reject(error.message ? error.message : error));
    }

}

module.exports = AdminClient;
