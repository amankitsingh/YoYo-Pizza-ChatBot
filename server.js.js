    'use strict';

    const functions = require('firebase-functions');
    const {
        WebhookClient
    } = require('dialogflow-fulfillment');

    const admin = require('firebase-admin');
    admin.initializeApp(functions.config().get);
    const db = admin.firestore();

    process.env.DEBUG = 'dialogflow:*';

    let doc_id, name, phone_number, address, pizza_type, pizza_toppings, pizza_size;

    exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
        const agent = new WebhookClient({
            request,
            response
        });
        console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
        console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

        function sendmessage(responce) {
            agent.add(responce);
        }

        function getOrderStatus(agent) {
            const params = agent.parameters;
            const find_doc = `${ params.given_name.toUpperCase()}_${params.phone_number.slice(0, 4)}`;

            const no_data = "No data found";
            try {
                return db.collection('order_id').doc(find_doc).get().then(snapshot => {
                    if (!snapshot.exists) {
                        agent.add(no_data);
                    } else {
                        console.log('Document data:', snapshot.data());
                        agent.add(`Your order is ${snapshot.data().order_status}`);
                    }
                }).catch(() => {
                    agent.add(no_data);
                });
            } catch (err) {
                console.log(err);
                agent.add(no_data);
            }
        }

        function getNameHandler(agent) {
            const params = agent.getContext('awaiting_name_confirm').parameters;
            name = params.name.toUpperCase();
            phone_number = params.phone_number;
            doc_id = `${name}_${phone_number}`;

            let welcome_responce = [
                `Thankyou! Welcome ${name} To YoYo pizza!!!`,
                `Pleasure to serve you ${name} to YoYo pizza today!!`,
                `${name} we welcome you to YoYo Pizza!!! `
            ];

            let address_responce = [
                `can you please provide your address?`,
                `Hey! I will need your address to assist your better!!!`,
                `I will Need your address for delivery purposes.`
            ];

            const pick_welcome = Math.floor(Math.random() * welcome_responce.length);
            const pick_address = Math.floor(Math.random() * address_responce.length);

            let responce = `${welcome_responce[pick_welcome]}  ${address_responce[pick_address]}`;

            console.log("Name and phone number added");

            sendmessage(responce);
        }

        function getAddressHandler(agent) {
            const params = agent.getContext("awaiting_address_confirm").parameters;
            if (params.geo_city && params.address) {
                address = `${params.address.toUpperCase()} ${params.geo_city.toUpperCase()} `;
            } else if (!params.geo_city && params.address) {
                address = `${params.address.toUpperCase()}`;
            }

            let address_responce = [
                `Thankyou for confirm your location as ${address}.`,
                `${address} confirmed.`,
                `Your address is confirmed as ${address}.`
            ];

            let pizza_type_responce = [
                "What type of pizza would you like to have today.(veg/nonveg)",
                "Can you please tell pizza type(veg/nonveg)?",
                "Please provide the type of pizza you want today(veg/nonveg)."
            ];

            const pick_address = Math.floor(Math.random() * address_responce.length);
            const pick_pizza_type = Math.floor(Math.random() * pizza_type_responce.length);

            let responce = `${address_responce[pick_address]}     ${pizza_type_responce[pick_pizza_type]}`;

            console.log("Address added");

            sendmessage(responce);
        }

        function getPizzaType(agent) {
            const params = agent.parameters.pizza_type;
            pizza_type = params.toUpperCase();

            let pizza_responce = [
                `${pizza_type} it is.`,
                `Okay, ${pizza_type} for today.`
            ];

            let pizza_toppings_responce = [
                `Please tell 2 additional toppings for your ${pizza_type} pizza.`,
                `What will be your toppings for ${pizza_type} pizza.`
            ];

            const pick_pizza = Math.floor(Math.random() * pizza_responce.length);
            const pick_pizza_topping = Math.floor(Math.random() * pizza_toppings_responce.length);

            let responce = `${pizza_responce[pick_pizza]}     ${pizza_toppings_responce[pick_pizza_topping]}`;

            console.log("Pizza type added");

            sendmessage(responce);
        }

        function getPizzaToppings(agent) {
            const params = agent.getContext('awaiting_toppings_confirm').parameters.pizza_toppings;
            pizza_toppings = params;

            console.log("Pizza Toppings added");
        }


        function getPizzaSize(agent) {
            let order_number = `${name}_${phone_number.slice(0,4)}`;

            const params = agent.getContext('awaiting_size_confirm').parameters.pizza_size;
            pizza_size = params.toUpperCase();
            try {
                db.collection('pizza').doc(doc_id).set({
                    name: name,
                    phone_number: phone_number,
                    address: address,
                    pizza_type: pizza_type,
                    pizza_size: pizza_size,
                    pizza_topping_1: pizza_toppings[0],
                    pizza_topping_2: pizza_toppings[1],
                    order_id: order_number
                }).then(() => {
                    console.log("Customer Data Saved!!!");
                }).catch(() => {
                    console.log("Could not save customer datail!!!");
                });

                const message = `Thank you! Your pizza will be delivered in 30 minutes. Your order number is ${order_number}
            Hope to serve you again!!!`;

                agent.add(message);

                db.collection('order_id').doc(order_number).set({
                    order_id: order_number,
                    order_status: "Pending"
                }).then(() => {
                    console.log("order Data Saved!!");
                }).catch(() => {
                    console.log("Could not save Order data!!!");
                });

                setTimeout(() => {
                    console.log("order changing to confirmed");
                    db.collection('order_id').doc(order_number).update({
                        order_status: "Confirmed"
                    });
                }, 3000);

                setTimeout(() => {
                    console.log("order changing to cooking");
                    db.collection('order_id').doc(order_number).update({
                        order_status: "Cooking"
                    });
                }, 4000);

                setTimeout(() => {
                    console.log("order changing to delivered");
                    db.collection('order_id').doc(order_number).update({
                        order_status: "Delivered!!!"
                    });
                }, 4000);

            } catch (err) {
                console.log(err);
                agent.add("Problem with server. Please Try again later!!!");
            }
        }


        let intentMap = new Map();
        intentMap.set('Order Status', getOrderStatus);
        intentMap.set('Confirm Name Yes', getNameHandler);
        intentMap.set('Get Location - yes', getAddressHandler);
        intentMap.set('Get Pizza type', getPizzaType);
        intentMap.set('pizza toppings - yes', getPizzaToppings);
        intentMap.set('Get pizza size - yes', getPizzaSize);
        agent.handleRequest(intentMap);
    });