'use strict';

const Express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const hogan = require('hogan-express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const Permissions = require('./lib/permissions');
const KeyCloakService = require('./lib/keyCloakService');
const AdminClient = require('./lib/adminClient');

/**
 * URL patterns for permissions. URL patterns documentation https://github.com/snd/url-pattern.
 */
const PERMISSIONS = new Permissions([
    ['/customers', 'post', 'res:customer', 'scopes:create'],
    ['/customers(*)', 'get', 'res:customer', 'scopes:view'],
    ['/campaigns', 'post', 'res:campaign', 'scopes:create'],
    ['/campaigns(*)', 'get', 'res:campaign', 'scopes:view'],
    ['/reports', 'post', 'res:report', 'scopes:create'],
    ['/reports(*)', 'get', 'res:report', 'scopes:view']
]).notProtect(
    '/favicon.ico', // just to not log requests
    '/login(*)',
    '/accessDenied',
    '/adminClient',
    '/adminApi(*)',
    '/adminApi/*',
    '/teste',

    /**
     * It is protected because of we need an access token. Better to move it to the protected area.
     */
    '/permissions',
    '/checkPermission'
);

let app = Express();

app.use(cors({
    origin: '*'
}));
app.use(bodyParser.json());
// hogan-express configuration to render html
app.set('view engine', 'html');
app.engine('html', hogan);

let keyCloak = new KeyCloakService(PERMISSIONS);

let adminClient = new AdminClient({
    realm: 'CatiSementesV3',
    serverUrl: 'http://10.153.18.52:8080',
    resource: 'CatiSementesFront',
    adminLogin: 'admin',
    adminPassword: 'admin'
});

configureMiddleware();
configureRoutes();

const server = app.listen(3030, '10.153', function () {
    const port = server.address().port;
    console.log('App listening at port %s', port);
});

function configureMiddleware() {
    app.use(Express.static(path.join(__dirname, 'static')));

    // for a Keycloak token
    app.use(cookieParser());

    // protection middleware is configured for all links
    const logoutUrl = '/logout';
    app.use(keyCloak.middleware(logoutUrl));
}

function configureRoutes() {
    let router = Express.Router();
    app.use('/', router);

    // example urls to check protection
    app.use('/campaigns', showUrl);
    app.use('/customers', showUrl);
    app.use('/upload', showUrl);
    app.use('/optimizer', showUrl);
    app.use('/reports', showUrl);
    app.use('/targets', showUrl);
    app.use('/teste', showResult);

    applicationRoutes();

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '/static/index.html')));
}

// this routes are used by this application
function applicationRoutes() {
    app.get('/teste', (req, res) => {
        res.json({ "Hello": "World 160823 0758"})
    });

    app.get('/adminApi/usuarios', (req, res) => {
        let retorno = {
            sucesso: false,
            mensagem: "",
            dados: []
        };

        adminClient.usersList().then(json => {
                console.log("Usuario sucesso")
                console.log(json)
                retorno.sucesso = true;
                retorno.dados = json;
                res.json(retorno);
            }).catch(error => {
                retorno.sucesso = false;
                retorno.mensagem = error;
                res.end(retorno);
            });
    });

    app.post('/adminApi/criarUsuario', (req, res) => {
        let retorno = {
            sucesso: false,
            mensagem: "",
            dados: []
        };

        let user = req.body;
        adminClient.createUser(user).then(json => {
            if(json !== undefined && json.hasOwnProperty("errorMessage")){
                retorno.sucesso = false;
                retorno.mensagem = json.errorMessage;
            }
            else {
                retorno.sucesso = true;
                retorno.dados = json;
            }            
            res.json(retorno);
        }).catch(error => {
            retorno.sucesso = false;
            retorno.mensagem = error;
            res.json(retorno);
        });
    });

    app.post('/adminApi/editarUsuario', (req, res) => {
        let retorno = {
            sucesso: false,
            mensagem: "",
            dados: []
        };

        let user = req.body;
        adminClient.updateUser(user).then(json => {
            retorno.sucesso = true;
            retorno.dados = json;
            res.json(retorno);
        }).catch(error => {
            retorno.sucesso = false;
            retorno.mensagem = error;
            res.end(retorno);
        });
    });

    app.post('/adminApi/excluirUsuario', (req, res) => {
        let retorno = {
            sucesso: false,
            mensagem: "",
            dados: []
        };

        let user = req.body;
        adminClient.deleteUserById(user.id).then(json => {
            if(json){
                retorno.sucesso = true;
                retorno.mensagem = "Excluído com sucesso";
            }
            else {
                retorno.sucesso = false;
                retorno.mensagem = "Erro ao excluir";
            }
            
            res.json(retorno);
        }).catch(error => {
            retorno.sucesso = false;
            retorno.mensagem = error;
            res.end(retorno);
        });
    });
}

function login(req, res) {
    keyCloak.loginUser(req.query.login, req.query.password, req, res).then(grant => {
        // console.log(grant.__raw);
        res.render('loginSuccess', {
            userLogin: req.query.login
        });
    }).catch(error => {
        // TODO put login failed code here (we can return 401 code)
        console.error(error);
        res.end('Login error: ' + error);
    });
}

function renderAdminClient(res, result) {
    res.end(JSON.stringify(result, null, 4));
}

function showResult(req, res){
    res.end(JSON.stringify({teste: 'teste'}));
}

function showUrl(req, res) {
    res.end('<a href="javascript: window.history.back()">back</a> Access acquired to ' + req.originalUrl);
}

