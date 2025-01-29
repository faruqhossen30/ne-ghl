const { mysqlPool } = require("../config/db");
const gameOptiondData = require("../data/greedyOptions");

const greddyGenerateWInPtion = async function (params) {
  try {
    mysqlPool.query(
        "select sum(`bet_amount`) as bet_amount, sum(CASE WHEN status = 'win' THEN bet_amount ELSE NULL END) as win_amount from `bets` WHERE DATE(created_at) = CURDATE()",
        function (err, result, fields) {
          console.log("result = ", result);
          const { bet_amount, win_amount } = result[0];
          const stock_amount = bet_amount - win_amount;
          const commission_amount = ((bet_amount - win_amount) / 100) * 10;
          const payable_amount = stock_amount - commission_amount;
    
          console.log("stock_amount", stock_amount);
          console.log("commission_amount", commission_amount);
          console.log("payable_amount", payable_amount);
    
          mysqlPool.query(
            "select *, bet_amount * rate AS return_amount from `bets` WHERE DATE(created_at) = CURDATE() and `round` = ?",
            [47],
            async function (err, result, fields) {
              // console.log(result);
              // item = result;
              if (result) {
                
                
                const clonedArray = await gameOptiondData.map((x) => x);
    
                result.map((bet) => {
                  const itemToUpdate = clonedArray.find(
                    (item) => item.option === bet.option_id
                  );
                  itemToUpdate.bet_amount += bet.bet_amount;
                  itemToUpdate.return_amount += bet.bet_amount * bet.rate;
                //   console.log(bet.option_id);
                });
    
                const randNumber = clonedArray
                  .filter((item) => {
                    if (item.return_amount < payable_amount) {
                      return item.option;
                    }
                  });
                // console.log('len', randNumber.length);
                // res.send().status(200);
                // console.log('randNumber', typeof randNumber);
                
                return randNumber[1];
              }
            }
          );
        }
      );
  } catch (error) {
    console.log(error);
    
  }
};

module.exports = greddyGenerateWInPtion;