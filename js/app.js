$(document).ready(function () {
    cardapio.eventos.init();
    cardapio.metodos.carregarEnderecoCliente();  // Carrega o endereço salvo, se houver
});

const API_KEY = '33aee6dc15b5474fa55571d614426efe';

var apiRespostaRecebida = false;

var cardapio = {};

var MEU_CARRINHO = [];
var MEU_ENDERECO = null;
var FORMA_PAGAMENTO = null;

var VALOR_CARRINHO = 0;
var VALOR_ENTREGA = 'Informe o local de entrega';

var CELULAR_EMPRESA = '77991480877';

var saborUm = null;
var saborDois = null;

cardapio.eventos = {

    init: () => {
        cardapio.metodos.obterItensCardapio();
        cardapio.metodos.carregarBotaoLigar();
        cardapio.metodos.carregarBotaoReserva();
    }

}

cardapio.metodos = {

    salvarEnderecoCliente: () => {
        const endereco = {
            cep: $("#txtCEP").val().trim(),
            endereco: $("#txtEndereco").val().trim(),
            bairro: $("#txtBairro").val().trim(),
            cidade: $("#txtCidade").val().trim(),
            uf: $("#ddlUf").val().trim(),
            numero: $("#txtNumero").val().trim(),
            complemento: $("#txtComplemento").val().trim()
        };
        localStorage.setItem("enderecoCliente", JSON.stringify(endereco));
    },
    
    carregarEnderecoCliente: () => {
        const enderecoSalvo = JSON.parse(localStorage.getItem("enderecoCliente"));
        if (enderecoSalvo) {
            $("#txtCEP").val(enderecoSalvo.cep);
            $("#txtEndereco").val(enderecoSalvo.endereco);
            $("#txtBairro").val(enderecoSalvo.bairro);
            $("#txtCidade").val(enderecoSalvo.cidade);
            $("#ddlUf").val(enderecoSalvo.uf);
            $("#txtNumero").val(enderecoSalvo.numero);
            $("#txtComplemento").val(enderecoSalvo.complemento);
        }
    },
    
    buscarCoordenadasEndereco: () => {
        let endereco = `${$("#txtEndereco").val()}, ${$("#txtNumero").val()}, ${$("#txtCidade").val()}, ${$("#ddlUf").val()}`;
        
        let enderecoCodificado = encodeURIComponent(endereco);
        let geoapifyURL = `https://api.geoapify.com/v1/geocode/search?text=${enderecoCodificado}&apiKey=${API_KEY}`;
    
        // Resetar a variável de controle ao iniciar a requisição
        apiRespostaRecebida = false;
    
        $.getJSON(geoapifyURL, (data) => {
            if (data.features.length > 0) {
                let coordenadas = data.features[0].geometry.coordinates;  // [longitude, latitude]
                let clienteLongitude = coordenadas[0];
                let clienteLatitude = coordenadas[1];
    
                cardapio.metodos.calcularDistancia(clienteLatitude, clienteLongitude);
                apiRespostaRecebida = true; // Resposta da API recebida
            } else {
                cardapio.metodos.mensagem('Não foi possível encontrar o endereço. Verifique se está correto.');
            }
        }).fail(() => {
            cardapio.metodos.mensagem('Erro ao tentar se comunicar com o serviço de geolocalização.');
        });
    },

    verificarRespostaAPI: () => {
        const tipoEntrega = $("#tipoEntrega").val();

        if (tipoEntrega === "entrega" && !apiRespostaRecebida) {
            cardapio.metodos.mensagem('Aguarde a confirmação do endereço.');
            return false; // Impede o avanço
        }
        return true; // Permite avançar
    },

    calcularDistancia: (clienteLatitude, clienteLongitude) => {
        const pizzariaLatitude = -14.851411836829914;  // Latitude da pizzaria
        const pizzariaLongitude = -42.43227979316853; // Longitude da pizzaria
    
        // URL da API Geoapify para calcular a distância
        let routingURL = `https://api.geoapify.com/v1/routing?waypoints=${pizzariaLatitude},${pizzariaLongitude}|${clienteLatitude},${clienteLongitude}&mode=drive&apiKey=${API_KEY}`;
    
        // Fazendo a requisição para Geoapify Routing API
        $.getJSON(routingURL, (data) => {
            if (data.features.length > 0) {
                let distanciaMetros = data.features[0].properties.distance;
                let distanciaKm = (distanciaMetros / 1000).toFixed(2);  // Converte para km
    
                // Atualizar o valor do frete com base na distância
                cardapio.metodos.calcularFrete(distanciaKm);
            } else {
                cardapio.metodos.mensagem('Não foi possível calcular a distância.');
            }
        });
    },
    
    calcularFrete: (distanciaKm) => {
        let valorFrete = 0;
    
        if (distanciaKm <= 1) {
            valorFrete = 4.00;
        } else if (distanciaKm > 1 && distanciaKm <= 2) {
            valorFrete = 6.00;
        } else if (distanciaKm > 2 && distanciaKm <= 3) {
            valorFrete = 7.00;
        } else if (distanciaKm > 3 && distanciaKm <= 4) {
            valorFrete = 8.00;
        } else if (distanciaKm > 4 && distanciaKm <= 5) {
            valorFrete = 9.00;
        } else if (distanciaKm > 5 && distanciaKm <= 7) {
            valorFrete = 10.00;
        } else if (distanciaKm > 7 && distanciaKm <= 10) {
            valorFrete = 12.00;
        } else {
            cardapio.metodos.mensagem('Distância fora da área de entrega.');
            return;
        }
    
        // Atualizar o valor do frete na interface
        $("#lblValorEntrega").text(`R$ ${valorFrete.toFixed(2).replace('.', ',')}`);
        $("#lblValorTotal").text(`R$ ${(VALOR_CARRINHO + valorFrete).toFixed(2).replace('.', ',')}`);
    
        // Guardar o valor do frete para uso posterior
        VALOR_ENTREGA = valorFrete;
    },
    
    verificarFormaPagamento: () => {
        // Obter o valor selecionado no dropdown
        var formaPagamento = $("#ddlPagamento").val();
    
        // Se a forma de pagamento for "Dinheiro", mostrar o campo para o valor do troco
        if (formaPagamento === "Dinheiro") {
            $("#campoTroco").removeClass('hidden');
        } else {
            // Caso contrário, ocultar o campo
            $("#campoTroco").addClass('hidden');
        }
    },
    

    // obtem a lista de itens do cardápio
    obterItensCardapio: (categoria = 'pizzas-t', vermais = false) => {
        // Obtenha o filtro com base na categoria selecionada
        var filtro = MENU[categoria];
        console.log(filtro);
    
        if (!vermais) {
            $("#itensCardapio").html('');
            $("#btnVerMais").removeClass('hidden');
        }
    
        // Verifica se a categoria atual é diferente de "meio-a-meio"
        if (categoria !== 'meio-a-meio') {
            // Adiciona a classe 'hidden' para ocultar os elementos de meio-a-meio
            $("#cardMensagem").addClass('hidden');
            $("#saborCustom").addClass('hidden');
    
            // Carrega os itens no formato normal
            $.each(filtro, (i, e) => {
                let temp = cardapio.templates.item.replace(/\${img}/g, e.img)
                    .replace(/\${nome}/g, e.name)
                    .replace(/\${preco}/g, e.price.toFixed(2).replace('.', ','))
                    .replace(/\${id}/g, e.id)
                    .replace(/\${descricao}/g, e.dsc);
    
                if (vermais && i >= 8 && i < 70) {
                    $("#itensCardapio").append(temp);
                }
    
                if (!vermais && i < 8) {
                    $("#itensCardapio").append(temp);
                }
            });
        } else {
            // Mostra a mensagem e carrega os itens no formato meio-a-meio
            $("#cardMensagem").removeClass('hidden');
            $("#cardMensagem").text("Selecione o primeiro sabor");
    
            $.each(filtro, (i, e) => {
                let temp = cardapio.templates.itemMeioaMeio.replace(/\${img}/g, e.img)
                    .replace(/\${nome}/g, e.name)
                    .replace(/\${preco}/g, e.price.toFixed(2).replace('.', ','))
                    .replace(/\${id}/g, e.id)
                    .replace(/\${descricao}/g, e.dsc);
    
                if (vermais && i >= 8 && i < 70) {
                    $("#itensCardapio").append(temp);
                }
    
                if (!vermais && i < 8) {
                    $("#itensCardapio").append(temp);
                }
            });
        }
    
        // Remove a classe 'active' de todos os links do menu e define o menu atual como ativo
        $(".container-menu a").removeClass('active');
        $("#menu-" + categoria).addClass('active');
    },
    
    iniciarItemCustom: () => {
        $("#saborCustom").removeClass('hidden');
    },

    adicionarCustomUm: (id) => {

        // Obtém o item do cardápio correspondente ao ID do sabor
        let categoria = $(".container-menu a.active").attr('id').split('menu-')[1];
        let filtro = MENU[categoria];
        saborUm = filtro.find(e => e.id === id);

        // Limpar a seleção do segundo sabor caso já tenha sido feita anteriormente
        saborDois = null;
        $(".btn-sabor-2").removeClass('disabled select');
        $(".badge-custom-2").addClass('hidden');

        // Habilitar todos os botões de sabor 2 e limpar classes `select` e `disabled`
        $(".btn-sabor-1, .btn-sabor-2").removeClass('select disabled');
        $(".badge-custom-1, .badge-custom-2").addClass('hidden');

        // Ocultar o menu customizado, pois o processo de seleção foi reiniciado
        $("#saborCustom").addClass('hidden');
        $("#saborCustom .title-custom").html("");  // Limpa o título customizado
        $("#saborCustom .price-custom").html("");  // Limpa o preço customizado
        
        // Remove a classe `select` e o badge de sabor 1 de qualquer card que tenha sido previamente selecionado
        $(".btn-sabor-1").removeClass('select'); // Remove a classe `select` de todos os botões
        $(".badge-custom-1").addClass('hidden');  // Oculta todos os badges de sabor

        // Adiciona a classe `select` ao botão de primeiro sabor do card atual e exibe o badge no card correto
        $(`#badgeCustomUm-${id}`).removeClass('hidden'); // Exibe o badge de sabor 1
        $(`#btnSaborUm-${id}`).addClass('select'); // Adiciona a classe `select` ao botão de primeiro sabor
        
        // Atualiza a mensagem para o usuário
        $("#cardMensagem").text("Selecione o segundo sabor");

        // Habilita todos os botões de segundo sabor (removendo a classe `.disabled`)
        $(".btn-sabor-2").removeClass('disabled');

        // desabilita o botão de segundo sabor do primeiro sabor selecionado
        $(`#btnSaborDois-${id}`).addClass('disabled');
    },

    adicionarCustomDois: (id) => {

        // Obtém o item do cardápio correspondente ao ID do sabor
        let categoria = $(".container-menu a.active").attr('id').split('menu-')[1];
        let filtro = MENU[categoria];
        saborDois = filtro.find(e => e.id === id);

        // Nome do item personalizado no carrinho
        let nomePersonalizado = `${saborUm.name} + ${saborDois.name}`;

        // Preço ajustado (média dos dois sabores)
        let precoPersonalizado = ((saborUm.price + saborDois.price) / 2).toFixed(2);

        // Exibir a `.sabor-custom` com o título e preço personalizados
        $("#saborCustom").removeClass('hidden');
        $("#saborCustom .title-custom").html(`<b>${nomePersonalizado}</b>`);
        $("#saborCustom .price-custom").html(`<b>R$ ${precoPersonalizado.replace('.', ',')}</b>`);

        // Cria novo item personalizado no carrinho
        let itemPersonalizado = {
            id: `meio-a-meio-${saborUm.id}-${saborDois.id}`,
            name: nomePersonalizado,
            price: parseFloat(precoPersonalizado),
            qntd: 1,
            img: saborUm.img // Usa a imagem do primeiro sabor como referência
        };

        // HTML para o botão de adicionar ao carrinho com o ID do item personalizado
        let htmlContent = `
        <span class="btn-menos" onclick="cardapio.metodos.diminuirQuantidade('${itemPersonalizado.id}')"><i class="fas fa-minus"></i></span>
        <span class="add-numero-itens" id="qntd-${itemPersonalizado.id}">1</span>
        <span class="btn-mais" onclick="cardapio.metodos.aumentarQuantidade('${itemPersonalizado.id}')"><i class="fas fa-plus"></i></span>
        <span class="btn btn-add" onclick="cardapio.metodos.adicionarAoCarrinho('${itemPersonalizado.id}')"><i class="fa fa-shopping-bag"></i></span>
        `;

        // Substitui o conteúdo de #add-carrinho-custom com o novo HTML
        $("#add-carrinho-custom").html(htmlContent);

        cardapio.metodos.iniciarItemCustom();

        // Remove a classe `select` e o badge de sabor 1 de qualquer card que tenha sido previamente selecionado
        $(".btn-sabor-2").removeClass('select'); // Remove a classe `select` de todos os botões
        $(".badge-custom-2").addClass('hidden');  // Oculta todos os badges de sabor

        // Adiciona a classe `select` ao botão de primeiro sabor do card atual e exibe o badge no card correto
        $(`#badgeCustomDois-${id}`).removeClass('hidden'); // Exibe o badge de sabor 2
        $(`#btnSaborDois-${id}`).addClass('select'); // Adiciona a classe `select` ao botão de segundo sabor

        // desabilita o botão de primeiro sabor do segundo sabor selecionado
        $(`#btnSaborUm-${id}`).addClass('disabled');
        
        // Atualiza a mensagem para o usuário
        $("#cardMensagem").text("Adicione sua pizza ao carrinho!");

        document.getElementById("cardapio").scrollIntoView({ behavior: 'smooth' });
    },

    // clique no botão de ver mais
    verMais: () => {

        var ativo = $(".container-menu a.active").attr('id').split('menu-')[1];
        cardapio.metodos.obterItensCardapio(ativo, true);

        $("#btnVerMais").addClass('hidden');

    },

    // diminuir a quantidade do item no cardapio
    diminuirQuantidade: (id) => {

        let qntdAtual = parseInt($("#qntd-" + id).text());

        if (qntdAtual > 0) {
            $("#qntd-" + id).text(qntdAtual - 1)
        }

    },

    // aumentar a quantidade do item no cardapio
    aumentarQuantidade: (id) => {

        let qntdAtual = parseInt($("#qntd-" + id).text());
        $("#qntd-" + id).text(qntdAtual + 1)

        console.log(id);

    },

    // adicionar ao carrinho o item do cardápio
    adicionarAoCarrinho: (id) => {
        let qntdAtual = parseInt($("#qntd-" + id).text());
    
        if (qntdAtual > 0) {
            // Verifica se o ID começa com "meio-a-meio-", indicando um item personalizado
            if (id.startsWith("meio-a-meio-")) {
                // Procura o item personalizado no carrinho pelo ID
                let itemPersonalizado = MEU_CARRINHO.find(e => e.id === id);
    
                if (itemPersonalizado) {
                    // Se já existe, apenas atualiza a quantidade
                    itemPersonalizado.qntd += qntdAtual;
                } else {
                    // Se não existe, cria um novo item personalizado no carrinho
                    let novoItem = {
                        id: id,
                        name: $("#saborCustom .title-custom b").text(),
                        price: parseFloat($("#saborCustom .price-custom b").text().replace('R$ ', '').replace(',', '.')),
                        qntd: qntdAtual,
                        img: saborUm.img // Usa a imagem do primeiro sabor como referência
                    };
                    MEU_CARRINHO.push(novoItem);
                }

                // Atualiza a mensagem no card para itens personalizados
                $("#cardMensagem").text("Pizza Meio a Meio adicionada ao carrinho!");

    
            } else {
                // Lógica original para itens normais do cardápio
                var categoria = $(".container-menu a.active").attr('id').split('menu-')[1];
                let filtro = MENU[categoria];
                let item = $.grep(filtro, (e) => e.id === id);
    
                if (item.length > 0) {
                    let existe = $.grep(MEU_CARRINHO, (elem) => elem.id === id);
    
                    if (existe.length > 0) {
                        let objIndex = MEU_CARRINHO.findIndex((obj) => obj.id === id);
                        MEU_CARRINHO[objIndex].qntd += qntdAtual;
                    } else {
                        item[0].qntd = qntdAtual;
                        MEU_CARRINHO.push(item[0]);
                    }
                }
            }
    
            // Exibe a mensagem de confirmação e redefine a quantidade visual
            cardapio.metodos.mensagem('Item adicionado ao carrinho', 'green');
            $("#qntd-" + id).text(0);
            cardapio.metodos.atualizarBadgeTotal();
        }
    },
    

    // atualiza o badge de totais dos botões "Meu carrinho"
    atualizarBadgeTotal: () => {

        var total = 0;

        $.each(MEU_CARRINHO, (i, e) => {
            total += e.qntd
        })

        if (total > 0) {
            $(".botao-carrinho").removeClass('hidden');
            $(".container-total-carrinho").removeClass('hidden');
        }
        else {
            $(".botao-carrinho").addClass('hidden')
            $(".container-total-carrinho").addClass('hidden');
        }

        $(".badge-total-carrinho").html(total);

    },

    // abrir a modal de carrinho
    abrirCarrinho: (abrir) => {

        if (abrir) {
            $("#modalCarrinho").removeClass('hidden');

            cardapio.metodos.carregarCarrinho();
        }
        else {
            $("#modalCarrinho").addClass('hidden');
        }

    },

    // altera os texto e exibe os botões das etapas
    carregarEtapa: (etapa) => {

        if (etapa == 1) {
            $("#lblTituloEtapa").text('Seu carrinho:');
            $("#itensCarrinho").removeClass('hidden');
            $("#localEntrega").addClass('hidden');
            $("#formaPagamento").addClass('hidden');
            $("#resumoCarrinho").addClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');

            $("#btnEtapaPedido").removeClass('hidden');
            $("#btnEtapaEndereco").addClass('hidden');
            $("#btnEtapaPagamento").addClass('hidden');
            $("#btnEtapaResumo").addClass('hidden');
            $("#btnVoltar").addClass('hidden');
        }
        
        if (etapa == 2) {
            $("#lblTituloEtapa").text('Endereço de entrega:');
            $("#itensCarrinho").addClass('hidden');
            $("#localEntrega").removeClass('hidden');
            $("#formaPagamento").addClass('hidden');
            $("#resumoCarrinho").addClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');
            $(".etapa2").addClass('active');

            $("#btnEtapaPedido").addClass('hidden');
            $("#btnEtapaEndereco").removeClass('hidden');
            $("#btnEtapaPagamento").addClass('hidden');
            $("#btnEtapaResumo").addClass('hidden');
            $("#btnVoltar").removeClass('hidden');
        }

        if (etapa == 3) {
            $("#lblTituloEtapa").text('Forma de pagamento:');
            $("#itensCarrinho").addClass('hidden');
            $("#localEntrega").addClass('hidden');
            $("#formaPagamento").removeClass('hidden');
            $("#resumoCarrinho").addClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');
            $(".etapa2").addClass('active');
            $(".etapa3").addClass('active');

            $("#btnEtapaPedido").addClass('hidden');
            $("#btnEtapaEndereco").addClass('hidden');
            $("#btnEtapaPagamento").removeClass('hidden');
            $("#btnEtapaResumo").addClass('hidden');
            $("#btnVoltar").removeClass('hidden');
        }

        if (etapa == 4) {
            $("#lblTituloEtapa").text('Resumo do pedido:');
            $("#itensCarrinho").addClass('hidden');
            $("#localEntrega").addClass('hidden');
            $("#formaPagamento").addClass('hidden');
            $("#resumoCarrinho").removeClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');
            $(".etapa2").addClass('active');
            $(".etapa3").addClass('active');
            $(".etapa4").addClass('active');

            $("#btnEtapaPedido").addClass('hidden');
            $("#btnEtapaEndereco").addClass('hidden');
            $("#btnEtapaPagamento").addClass('hidden');
            $("#btnEtapaResumo").removeClass('hidden');
            $("#btnVoltar").removeClass('hidden');
        }

    },

    // botão de voltar etapa
    voltarEtapa: () => {

        let etapa = $(".etapa.active").length;
        cardapio.metodos.carregarEtapa(etapa - 1);

    },

    // carrega a lista de itens do carrinho
    carregarCarrinho: () => {

        cardapio.metodos.carregarEtapa(1);

        if (MEU_CARRINHO.length > 0) {

            $("#itensCarrinho").html('');

            $.each(MEU_CARRINHO, (i, e) => {

                let temp = cardapio.templates.itemCarrinho.replace(/\${img}/g, e.img)
                .replace(/\${nome}/g, e.name)
                .replace(/\${preco}/g, e.price.toFixed(2).replace('.', ','))
                .replace(/\${id}/g, e.id)
                .replace(/\${qntd}/g, e.qntd)

                $("#itensCarrinho").append(temp);

                // último item
                if ((i + 1) == MEU_CARRINHO.length) {
                    cardapio.metodos.carregarValores();
                }

            })

        }
        else {
            $("#itensCarrinho").html('<p class="carrinho-vazio"><i class="fa fa-shopping-bag"></i> Seu carrinho está vazio.</p>');
            cardapio.metodos.carregarValores();
        }

    },

    // diminuir quantidade do item no carrinho
    diminuirQuantidadeCarrinho: (id) => {

        let qntdAtual = parseInt($("#qntd-carrinho-" + id).text());

        if (qntdAtual > 1) {
            $("#qntd-carrinho-" + id).text(qntdAtual - 1);
            cardapio.metodos.atualizarCarrinho(id, qntdAtual - 1);
        }
        else {
            cardapio.metodos.removerItemCarrinho(id)
        }

    },

    // aumentar quantidade do item no carrinho
    aumentarQuantidadeCarrinho: (id) => {

        let qntdAtual = parseInt($("#qntd-carrinho-" + id).text());
        $("#qntd-carrinho-" + id).text(qntdAtual + 1);
        cardapio.metodos.atualizarCarrinho(id, qntdAtual + 1);

    },

    // botão remover item do carrinho
    removerItemCarrinho: (id) => {

        MEU_CARRINHO = $.grep(MEU_CARRINHO, (e, i) => { return e.id != id });
        cardapio.metodos.carregarCarrinho();

        // atualiza o botão carrinho com a quantidade atualizada
        cardapio.metodos.atualizarBadgeTotal();
        
    },

    // atualiza o carrinho com a quantidade atual
    atualizarCarrinho: (id, qntd) => {

        let objIndex = MEU_CARRINHO.findIndex((obj => obj.id == id));
        MEU_CARRINHO[objIndex].qntd = qntd;

        // atualiza o botão carrinho com a quantidade atualizada
        cardapio.metodos.atualizarBadgeTotal();

        // atualiza os valores (R$) totais do carrinho
        cardapio.metodos.carregarValores();

    },

    // carrega os valores de SubTotal, Entrega e Total
    carregarValores: () => {

        VALOR_CARRINHO = 0;

        $("#lblSubTotal").text('R$ 0,00');
        $("#lblValorEntrega").text('Informe o local de entrega');
        $("#lblValorTotal").text('R$ 0,00');

        $.each(MEU_CARRINHO, (i, e) => {

            VALOR_CARRINHO += parseFloat(e.price * e.qntd);

            if ((i + 1) == MEU_CARRINHO.length) {
                $("#lblSubTotal").text(`R$ ${VALOR_CARRINHO.toFixed(2).replace('.', ',')}`);
                $("#lblValorEntrega").text(`${VALOR_ENTREGA}`);
                $("#lblValorTotal").text(`R$ ${(VALOR_CARRINHO).toFixed(2).replace('.', ',')}`);
            }

        })

    },

    // carregar a etapa enderecos
    carregarEndereco: () => {

        if (MEU_CARRINHO.length <= 0) {
            cardapio.metodos.mensagem('Seu carrinho está vazio.')
            return;
        } 

        cardapio.metodos.carregarEtapa(2);

    },

    // API ViaCEP
    buscarCep: () => {

        // cria a variavel com o valor do cep
        var cep = $("#txtCEP").val().trim().replace(/\D/g, '');

        // verifica se o CEP possui valor informado
        if (cep != "") {

            // Expressão regular para validar o CEP
            var validacep = /^[0-9]{8}$/;

            if (validacep.test(cep)) {

                $.getJSON("https://viacep.com.br/ws/" + cep + "/json/?callback=?", function (dados) {

                    if (!("erro" in dados)) {

                        // Atualizar os campos com os valores retornados
                        $("#txtEndereco").val(dados.logradouro);
                        $("#txtBairro").val(dados.bairro);
                        $("#txtCidade").val(dados.localidade);
                        $("#ddlUf").val(dados.uf);
                        $("#txtNumero").focus();

                    }
                    else {
                        cardapio.metodos.mensagem('CEP não encontrado. Preencha as informações manualmente.');
                        $("#txtEndereco").focus();
                    }

                })

            }
            else {
                cardapio.metodos.mensagem('Formato do CEP inválido.');
                $("#txtCEP").focus();
            }

        }
        else {
            cardapio.metodos.mensagem('Informe o CEP, por favor.');
            $("#txtCEP").focus();
        }
        
    },
    
    // Função para mostrar ou ocultar o formulário de endereço
    mostrarFormularioEntrega: () => {
        const tipoEntrega = $("#tipoEntrega").val();
        
        if (tipoEntrega === "entrega") {
            $("#campoEntrega").removeClass('hidden');  // Exibe o formulário de endereço
        } else {
            $("#campoEntrega").addClass('hidden');  // Oculta o formulário de endereço
        }
    },

    // validação antes de prosseguir para a etapa 3
    carregarPagamento: () => {

        const tipoEntrega = $("#tipoEntrega").val();  // Verificar o tipo de entrega

        // Se for "Retirar no Local", pula a validação de endereço
        if (tipoEntrega === "local") {
        MEU_ENDERECO = null;  // Não precisa de endereço
        VALOR_ENTREGA = 0;
        $("#lblValorEntrega").text('R$ 0,00');
        $("#lblValorTotal").text(`R$ ${(VALOR_CARRINHO).toFixed(2).replace('.', ',')}`)
        cardapio.metodos.carregarEtapa(3);  // Avança para a próxima etapa
        return;
        }

        let cep = $("#txtCEP").val().trim();
        let endereco = $("#txtEndereco").val().trim();
        let bairro = $("#txtBairro").val().trim();
        let cidade = $("#txtCidade").val().trim();
        let uf = $("#ddlUf").val().trim();
        let numero = $("#txtNumero").val().trim();
        let complemento = $("#txtComplemento").val().trim();
        
        if (cep.length <= 0) {
            cardapio.metodos.mensagem('Informe o CEP, por favor.');
            $("#txtCEP").focus();
            return;
        }
        
        if (endereco.length <= 0) {
            cardapio.metodos.mensagem('Informe o Endereço, por favor.');
            $("#txtEndereco").focus();
            return;
        }

        if (cidade.length <= 0) {
            cardapio.metodos.mensagem('Informe a Cidade, por favor.');
            $("#txtCidade").focus();
            return;
        }

        if (uf == "-1") {
            cardapio.metodos.mensagem('Informe a UF, por favor.');
            $("#ddlUf").focus();
            return;
        }

        if (numero.length <= 0) {
            cardapio.metodos.mensagem('Informe o Número, por favor.');
            $("#txtNumero").focus();
            return;
        }

        MEU_ENDERECO = {
            cep: cep,
            endereco: endereco,
            bairro: bairro,
            cidade: cidade,
            uf: uf,
            numero: numero,
            complemento: complemento
        }

        if (cep.length > 0 && endereco.length > 0 && cidade.length > 0 && uf !== "-1" && numero.length > 0) {
        cardapio.metodos.salvarEnderecoCliente();
        cardapio.metodos.buscarCoordenadasEndereco();
        cardapio.metodos.carregarEtapa(3);
}

    },

    // validação antes de prosseguir para a etapa 4
    resumoPedido: () => {
        // Verificar se a resposta da API foi recebida antes de continuar
        if (!cardapio.metodos.verificarRespostaAPI()) {
            return; // Bloqueia o avanço se a resposta não tiver chegado
        }
    
        let formaPagamento = $("#ddlPagamento").val().trim();
        if (formaPagamento === "-1") {
            cardapio.metodos.mensagem('Selecione a forma de pagamento.');
            $("#ddlPagamento").focus();
            return;
        }
    
        FORMA_PAGAMENTO = {
            formaPagamento: formaPagamento
        };
    
        // Se a forma de pagamento for "Dinheiro", capturar o valor do troco
        if (formaPagamento === "Dinheiro") {
            let valorTroco = $("#valorTroco").val().trim();
            
            if (valorTroco.length <= 0) {
                cardapio.metodos.mensagem('Informe o valor em dinheiro para o troco.');
                $("#valorTroco").focus();
                return;
            }
            
            FORMA_PAGAMENTO.valorTroco = valorTroco;
        }
    
        cardapio.metodos.carregarEtapa(4);
        cardapio.metodos.carregarResumo();
    },


    // carrega a etapa de Resumo do pedido
    carregarResumo: () => {
        if (FORMA_PAGAMENTO.length <= 0) {
            cardapio.metodos.mensagem('Selecione a forma de pagamento.');
            return;
        }
    
        cardapio.metodos.carregarEtapa(4);
    
        $("#listaItensResumo").html('');
    
        // Exibir os itens do carrinho
        $.each(MEU_CARRINHO, (i, e) => {
            let temp = cardapio.templates.itemResumo.replace(/\${img}/g, e.img)
                .replace(/\${nome}/g, e.name)
                .replace(/\${preco}/g, e.price.toFixed(2).replace('.', ','))
                .replace(/\${qntd}/g, e.qntd)
    
            $("#listaItensResumo").append(temp);
        });
    
        // Exibir o endereço de entrega ou a opção "local"
        const tipoEntrega = $("#tipoEntrega").val();
        if (tipoEntrega === "local") {
            $("#resumoEndereco").html('Retirar no Local');
        } else {
            $("#resumoEndereco").html(`${MEU_ENDERECO.endereco}, ${MEU_ENDERECO.numero}, ${MEU_ENDERECO.bairro}`);
            $("#cidadeEndereco").html(`${MEU_ENDERECO.cidade}-${MEU_ENDERECO.uf} / ${MEU_ENDERECO.cep} ${MEU_ENDERECO.complemento}`);
        }
    
        // Exibir a forma de pagamento
        let formaPagamentoResumo = `${FORMA_PAGAMENTO.formaPagamento}`;
    
        // Se a forma de pagamento for "Dinheiro", incluir o valor informado
        if (FORMA_PAGAMENTO.formaPagamento === "Dinheiro") {
            formaPagamentoResumo += ` (vai dar R$ ${FORMA_PAGAMENTO.valorTroco.replace('.', ',')})`;
        }
    
        $("#tipoPagamento").html(formaPagamentoResumo);
    
        cardapio.metodos.finalizarPedido();
    },
    
    

    // Atualiza o link do botão do WhatsApp
    finalizarPedido: () => {
        if (MEU_CARRINHO.length > 0) {
    
            var texto = 'Olá! Gostaria de fazer um pedido:';
            texto += `\n*Itens do pedido:*\n\n`;
    
            var itens = '';
    
            // Adiciona os itens do carrinho à mensagem
            $.each(MEU_CARRINHO, (i, e) => {
                itens += `*${e.qntd}x* ${e.name} ....... R$ ${e.price.toFixed(2).replace('.', ',')} \n`;
            });
    
            texto += itens;
    
            // Verificar o tipo de entrega e atualizar a mensagem conforme a escolha
            const tipoEntrega = $("#tipoEntrega").val();
            if (tipoEntrega === "local") {
                texto += '\n*Retirar no Local*';
            } else {
                texto += '\n*Endereço de entrega:*';
                texto += `\n${MEU_ENDERECO.endereco}, ${MEU_ENDERECO.numero}, ${MEU_ENDERECO.bairro}`;
                texto += `\n${MEU_ENDERECO.cidade}-${MEU_ENDERECO.uf} / ${MEU_ENDERECO.cep} ${MEU_ENDERECO.complemento}`;
            }
    
            texto += '\n\n*Forma de Pagamento:*';
            texto += `\n${FORMA_PAGAMENTO.formaPagamento}`;
    
            // Se a forma de pagamento for "Dinheiro", adicionar o valor
            if (FORMA_PAGAMENTO.formaPagamento === "Dinheiro") {
                texto += `\nTroco para o valor de: R$ ${FORMA_PAGAMENTO.valorTroco.replace('.', ',')}`;
            }
    
            texto += `\n\n*Total (com entrega): R$ ${(VALOR_CARRINHO + VALOR_ENTREGA).toFixed(2).replace('.', ',')}*`;
    
            // Converte o texto em uma URL codificada para o WhatsApp
            let encode = encodeURI(texto);
            let URL = `https://wa.me/${CELULAR_EMPRESA}?text=${encode}`;
    
            // Atualiza o botão de envio com o link do WhatsApp
            $("#btnEtapaResumo").attr('href', URL);
        }
    },
    
    
    // carrega o link do botão reserva
    carregarBotaoReserva: () => {

        var texto = 'Olá! gostaria de fazer uma *reserva*';

        let encode = encodeURI(texto);
        let URL = `https://wa.me/${CELULAR_EMPRESA}?text=${encode}`;

        $("#btnReserva").attr('href', URL);

    },

    // carrega o botão de ligar
    carregarBotaoLigar: () => {

        $("#btnLigar").attr('href', `https://wa.me/77991480877?text=`);

    },

    // abre o depoimento
    abrirDepoimento: (depoimento) => {

        $("#depoimento-1").addClass('hidden');
        $("#depoimento-2").addClass('hidden');
        $("#depoimento-3").addClass('hidden');

        $("#btnDepoimento-1").removeClass('active');
        $("#btnDepoimento-2").removeClass('active');
        $("#btnDepoimento-3").removeClass('active');

        $("#depoimento-" + depoimento).removeClass('hidden');
        $("#btnDepoimento-" + depoimento).addClass('active');

    },

    // mensagens
    mensagem: (texto, cor = 'red', tempo = 3500) => {

        let id = Math.floor(Date.now() * Math.random()).toString();

        let msg = `<div id="msg-${id}" class="animated fadeInDown toast ${cor}">${texto}</div>`;

        $("#container-mensagens").append(msg);

        setTimeout(() => {
            $("#msg-" + id).removeClass('fadeInDown');
            $("#msg-" + id).addClass('fadeOutUp');
            setTimeout(() => {
                $("#msg-" + id).remove();
            }, 800);
        }, tempo)

    }

}

cardapio.templates = {

    item: `
        <div class="col-12 col-lg-3 col-md-3 col-sm-6 mb-5 animated fadeInUp">
            <div class="card card-item" id="\${id}">
                <div class="img-produto">
                    <img src="\${img}" />
                </div>
                <p class="title-produto text-center mt-4">
                    <b>\${nome}</b>
                </p>
                <p class="price-produto text-center">
                    <b>R$ \${preco}</b>
                </p>
                <div class="add-carrinho">
                    <span class="btn-menos" onclick="cardapio.metodos.diminuirQuantidade('\${id}')"><i class="fas fa-minus"></i></span>
                    <span class="add-numero-itens" id="qntd-\${id}">0</span>
                    <span class="btn-mais" onclick="cardapio.metodos.aumentarQuantidade('\${id}')"><i class="fas fa-plus"></i></span>
                    <span class="btn btn-add" onclick="cardapio.metodos.adicionarAoCarrinho('\${id}')"><i class="fa fa-shopping-bag"></i></span>
                </div>
                <div class="card-dsc" id="\${id}">
                    <p class="title-dsc mt-4 text-center">
                        <b>\${nome}</b>
                    </p>
                    <p class="dsc-produto text-center">
                        \${descricao}
                     </p>
                </div>
            </div>
        </div>
    `,

    itemMeioaMeio: `
        <div class="col-12 col-lg-3 col-md-3 col-sm-6 mb-5 animated fadeInUp">
            <div class="card card-item" id="\${id}">
                <div class="badge-custom-1 hidden" id="badgeCustomUm-\${id}">1</div>
                <div class="badge-custom-2 hidden" id="badgeCustomDois-\${id}">2</div>
                <div class="img-produto">
                    <img src="\${img}" />
                </div>
                <p class="title-produto text-center mt-4">
                    <b>\${nome}</b>
                </p>
                <p class="price-produto text-center">
                    <b>R$ \${preco}</b>
                </p>
                <div class="add-carrinho">
                    <span class="btn-sabor-1" id="btnSaborUm-\${id}" onclick="cardapio.metodos.adicionarCustomUm('\${id}')">1</span>
                    <span class="btn-sabor-2 disabled" id="btnSaborDois-\${id}" onclick="cardapio.metodos.adicionarCustomDois('\${id}')">2</span>
                </div>
                <div class="card-dsc" id="\${id}">
                    <p class="title-dsc mt-4 text-center">
                        <b>\${nome}</b>
                    </p>
                    <p class="dsc-produto text-center">
                        \${descricao}
                     </p>
                </div>
            </div>
        </div>
    `,

    itemCarrinho: `
        <div class="col-12 item-carrinho">
            <div class="img-produto">
                <img src="\${img}" />
            </div>
            <div class="dados-produto">
                <p class="title-produto"><b>\${nome}</b></p>
                <p class="price-produto"><b>R$ \${preco}</b></p>
            </div>
            <div class="add-carrinho">
                <span class="btn-menos" onclick="cardapio.metodos.diminuirQuantidadeCarrinho('\${id}')"><i class="fas fa-minus"></i></span>
                <span class="add-numero-itens" id="qntd-carrinho-\${id}">\${qntd}</span>
                <span class="btn-mais" onclick="cardapio.metodos.aumentarQuantidadeCarrinho('\${id}')"><i class="fas fa-plus"></i></span>
                <span class="btn btn-remove no-mobile" onclick="cardapio.metodos.removerItemCarrinho('\${id}')"><i class="fa fa-times"></i></span>
            </div>
        </div>
    `,

    itemResumo: `
        <div class="col-12 item-carrinho resumo">
            <div class="img-produto-resumo">
                <img src="\${img}" />
            </div>
            <div class="dados-produto">
                <p class="title-produto-resumo">
                    <b>\${nome}</b>
                </p>
                <p class="price-produto-resumo">
                    <b>R$ \${preco}</b>
                </p>
            </div>
            <p class="quantidade-produto-resumo">
                x <b>\${qntd}</b>
            </p>
    `

}