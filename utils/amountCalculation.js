async function finalPayableAmount(number) {
    if (number < 0) {
        return 0;
    }
    return number;
}

module.exports = {finalPayableAmount}