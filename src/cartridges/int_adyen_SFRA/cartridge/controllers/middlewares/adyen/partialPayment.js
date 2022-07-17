const AdyenHelper = require('*/cartridge/scripts/util/adyenHelper');
const AdyenConfigs = require('*/cartridge/scripts/util/adyenConfigs');

const BasketMgr = require('dw/order/BasketMgr');
const PaymentMgr = require('dw/order/PaymentMgr');
const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');
const OrderMgr = require('dw/order/OrderMgr');
const URLUtils = require('dw/web/URLUtils');
const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const constants = require('*/cartridge/adyenConstants/constants');
const collections = require('*/cartridge/scripts/util/collections');

function makePartialPayment(req, res, next) {
    try {
        Logger.getLogger('Adyen').error('inside  makePartialPayment');
        const request = JSON.parse(req.body);
        Logger.getLogger('Adyen').error('request is ' + JSON.stringify(request));

        const {paymentMethod, splitPaymentsOrder, amount} = request;

        const partialPaymentRequest = {
            merchantAccount: AdyenConfigs.getAdyenMerchantAccount(),
            amount,
            reference: "partialPaymentRef",
            paymentMethod,
            order: splitPaymentsOrder,
        };
        Logger.getLogger('Adyen').error('partialPaymentrequest is ' + JSON.stringify(partialPaymentRequest));


        const currentBasket = BasketMgr.getCurrentBasket();
        let paymentInstrument;
        Transaction.wrap(() => {
            collections.forEach(currentBasket.getPaymentInstruments(), (item) => {
                currentBasket.removePaymentInstrument(item);
            });
            paymentInstrument = currentBasket.createPaymentInstrument(
                constants.METHOD_ADYEN_COMPONENT,
                currentBasket.totalGrossPrice,
            );
            const { paymentProcessor } = PaymentMgr.getPaymentMethod(
                paymentInstrument.paymentMethod,
            );
            paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
            paymentInstrument.custom.adyenPaymentData = partialPaymentRequest.paymentMethod;
            paymentInstrument.custom.adyenSplitPaymentsOrder = request.splitPaymentsOrder;
            paymentInstrument.custom.adyenPaymentMethod = `split payment: ${request.paymentMethod.type} ${request.paymentMethod.brand ? request.paymentMethod.brand : ""}` ;
            Logger.getLogger('Adyen').error('paymentInstrument.custom.adyenPaymentMethod is ' + JSON.stringify(paymentInstrument.custom.adyenPaymentMethod));
        });
//        const order = COHelpers.createOrder(currentBasket);


        const response = adyenCheckout.doPaymentsCall(0, 0, partialPaymentRequest);

        Transaction.wrap(() => {
            paymentInstrument.paymentTransaction.custom.Adyen_log = JSON.stringify(response);
        });
        Logger.getLogger('Adyen').error('paymentInstrument.paymentTransaction.custom.Adyen_log ' + JSON.stringify(paymentInstrument.paymentTransaction.custom.Adyen_log));
        Logger.getLogger('Adyen').error('partial payment response is ' + JSON.stringify(response));

        res.json(response);
        return next();
    } catch (error) {
        Logger.getLogger('Adyen').error('Failed to create partial payment');
        Logger.getLogger('Adyen').error(error);
        return next();
    }
}

module.exports = makePartialPayment;
