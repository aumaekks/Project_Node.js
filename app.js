const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');



const app = express();
app.use(express.urlencoded({extended:false}));

app.use(express.static('public'));

app.set('views', path.join(__dirname,'views'));
app.set('view engine','ejs');


app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge:  3600 * 1000 // 1hr
}));


const ifNotLoggedin = (req, res, next) => {
    if(!req.session.isLoggedIn){
        return res.render('index');
    }
    next();
}
const ifLoggedin = (req,res,next) => {
    if(req.session.isLoggedIn){
        return res.redirect('/');
    }
    next();
}

const ifNotadmin = (req,res,next) =>{
    if(!req.session.isAddmin){
        res.redirect('/');
    }next();
}

const ifadmin = (req,res,next) =>{
    if(req.session.isAddmin){
       return res.render('home_adim',{
            name:req.session.name
        });
    }next();
}

const ifItadmin = (req,res,next)=>{
    if(req.session.isAddmin){
        res.redirect('/');
    }next()
}
const check_admin = (req,res,next) =>{
    dbConnection.execute("SELECT * FROM admin where email = ? and password = ? ",[req.body.customer_email,req.body.customer_password])
    .then(row=>{
        if(row[0].length > 0){
            req.session.isLoggedIn = true;
            req.session.userID = row[0][0].admin_id;
            req.session.name = row[0][0].admin_name;
            req.session.isAddmin = true;
            res.redirect('/')
        } next();
    })
}

const if_executive = (req,res,next) => {
    if(req.session.isexecutive){
        return res.render('executive_home',{
            name:req.session.name
        })
    }next();
}

const ifNotExecutive = (req,res,next) => {
    if(!req.session.isexecutive){
        return res.redirect('/');
    }next();
}

const if_it_executive = (req,res,next) =>{
    if(req.session.isexecutive){
        return res.redirect('/');
    }next();
}

const check_executive = (req,res,next) =>{
    dbConnection.execute("SELECT * FROM executive where email = ? and password=? ",[req.body.customer_email,req.body.customer_password])
    .then(row=>{
        if(row[0].length > 0){
            // console.log(row[0][0].executive_name)
            req.session.isLoggedIn = true;
            req.session.userID = row[0][0].executive_id;
            req.session.name = row[0][0].executive_name;
            req.session.isexecutive = true;
            res.redirect('/')
        } next();
    })
}


app.get('/', ifNotLoggedin, ifadmin ,if_executive,(req,res,next) => {
    dbConnection.execute("SELECT `customer_name` FROM `customer` WHERE `customer_id`=?",[req.session.userID])
    .then(([rows]) => {
        req.session.name = rows[0].customer_name;

        res.render('home',{
            name:rows[0].customer_name
        });
    });
    
});

app.get('/login',ifLoggedin,(req,res)=>{
    if(!req.session.isLoggedIn){
        return res.render('login');
    }
});

app.get('/register',ifLoggedin,(req,res)=>{
    if(!req.session.isLoggedIn){
        return res.render('register');
    }
});

const get_current_date = () =>{
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate; // Output: "2023-02-27"

}
// REGISTER PAGE
app.post('/register', ifLoggedin, 

[
    body('customer_email','Invalid email address!').isEmail().custom((value) => {
        return dbConnection.execute('SELECT `email` FROM `customer` WHERE `email`=?', [value])
        .then(([rows]) => {
            if(rows.length > 0){
                return Promise.reject('This E-mail already in use!');
            }
            return true;
        });
    }),
    body('customer_name','Username is Empty!').trim().not().isEmpty(),
    body('customer_pass','The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
    body('customer_gender','Username is Empty!').trim().not().isEmpty(),
    body('customer_date','Username is Empty!').trim().not().isEmpty(),

],
(req,res) => {
    dbConnection.execute('SELECT * FROM membertype')
    .then((rows)=>{
        res.render('membertype',{
            customer_name:req.body.customer_name,
            customer_pass:req.body.customer_pass,
            customer_email:req.body.customer_email,
            customer_gender:req.body.customer_gender,
            customer_date:req.body.customer_date,
            membertype_list:rows
        });
    })
});

app.post('/confirmation', ifLoggedin,  (req, res) => {
    const validation_result = validationResult(req);

    const customer_name = req.body.customer_name;
    const customer_pass = req.body.customer_pass;
    const customer_email = req.body.customer_email;
    const customer_gender = req.body.customer_gender;
    const customer_date = req.body.customer_date;
    const membertype = req.body.membertype;
    if(validation_result.isEmpty()){
        
        dbConnection.execute("SELECT * FROM `membertype` WHERE `type_id`=?",[membertype])
        .then(([rows]) => {
            var currentDate = new Date();
            var newDate = new Date(currentDate);

            if(rows[0].type_name === 'day'){
                newDate.setDate(currentDate.getDate() + rows[0].duration);
            }else if(rows[0].type_name === 'month'){
                var originalDayOfMonth = currentDate.getDate();
                newDate.setMonth(currentDate.getMonth() + rows[0].duration);
                var daysInMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 0).getDate();
                newDate.setDate(Math.min(originalDayOfMonth, daysInMonth));
            }

            const mysqlDate = newDate.toISOString().substring(0, 10);
            bcrypt.hash(customer_pass, 12).then((hash_pass) => {
                        // INSERTING USER INTO DATABASE
                        dbConnection.execute("INSERT INTO `customer`(`customer_name`,`email`,`password`,`gender`,`date_of_birth`,`point`,`payment_schedule`,`suspended_date`,`type_id`) VALUES(?,?,?,?,?,?,?,?,?)",[customer_name,customer_email, hash_pass,customer_gender,customer_date,0,get_current_date(),null,membertype])
                        .then(result => {
                            res.redirect(`/`);
                        }).catch(err => {
                            // THROW INSERTING USER ERROR'S
                            if (err) throw err;
                        });
                    })
                    .catch(err => {
                        // THROW HASING ERROR'S
                        if (err) throw err;
                    })

        }).catch(err => {
            if (err) throw err;
        });
    }
    else{
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        
        res.render('register',{
            login_errors:allErrors
        });
    }
});

// END OF REGISTER PAGE


// LOGIN PAGE
app.post('/login', ifLoggedin, check_admin ,check_executive,[
    body('customer_email').custom((value) => {
        return dbConnection.execute('SELECT email FROM customer WHERE email=?', [value])
        .then(([rows]) => {
            if(rows.length == 1){
                return true;
                
            }
            return Promise.reject('Invalid Email Address!');
            
        });
    }),
    body('customer_password','Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const user_pass = req.body.customer_password;
    const user_email = req.body.customer_email;
    
    if(validation_result.isEmpty()){
        
        dbConnection.execute("SELECT * FROM `customer` WHERE `email`=?",[user_email])
        .then(([rows]) => {
            bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                if(compare_result === true){
                    req.session.isLoggedIn = true;
                    req.session.userID = rows[0].customer_id;
                    req.session.booking_id = [];
                    req.session.class_booking_id = [];
                    res.redirect('/');
                }
                else{
                    res.render('login',{
                        login_errors:['Invalid Password!']
                    });
                }
            })
            .catch(err => {
                if (err) throw err;
            });


        }).catch(err => {
            if (err) throw err;
        });
    }
    else{
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        
        res.render('login',{
            login_errors:allErrors
        });
    }
});
// END OF LOGIN PAGE

// LOGOUT
app.get('/logout',(req,res)=>{
    //session destroy
    req.session = null;
    res.redirect('/');
});
// END OF LOGOUT

// trainer search================
app.get('/trinaersearch',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
   if(req.query.t_id){
        dbConnection.execute('SELECT * FROM trainerschedule,trainer WHERE trainerschedule.trainer_id = trainer.trainer_id and trainerschedule.trainer_id = ?',[req.query.t_id])
        .then(([rows])=>{
            
            res.render('trainerschedule',{
                trainerschedule_list:rows,
                trainer_name:rows[0].trainer_name
            });
        })
   }else if(req.query.t_book_id){
        dbConnection.execute("SELECT * ,DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age FROM trainerschedule,trainer WHERE trainerschedule.trainer_id = trainer.trainer_id and trainerschedule.trainerschedule_id = ?",[req.query.t_book_id])
        .then(([rows])=>{
            res.render('booking',{
                trainer_booking:rows,
            })
        })
   }else{
        if(req.query.trainername){
            
            dbConnection.execute("SELECT * ,DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender FROM trainer WHERE trainer_name LIKE '%"+req.query.trainername+"%'")
            .then(([rows])=>{
                res.render('trainersearching',{
                trainer_list:rows,
                trainer_name:req.query.trainername
                })
            });
            
        }else{
            dbConnection.execute("SELECT * ,DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender FROM trainer")
            .then(([rows])=>{
                res.render('trainersearching',{
                    trainer_list:rows
                })
            });
           }
   }
});


//==========booking search ====================
app.get('/classsearch',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_id){
        
        dbConnection.execute('SELECT * FROM exerciseclass,exerciseclassschedule WHERE exerciseclass.class_id = exerciseclassschedule.class_id AND exerciseclass.class_id = ?', [req.query.t_id])
        .then(([rows]) => {
            
            const promises = rows.map((row) => {
                
                return dbConnection.execute('SELECT COUNT(*) AS count FROM classbooking WHERE WEEK(classbook_date) = WEEK(?) and classschedule_id = ?', [get_current_date(),row.classschedule_id])
                    .then(([countResult]) => {
                        const count = countResult[0].count;
                
                        return {
                            classSchedule: row,
                            count: count
                        };
                    });
            });

            return Promise.all(promises);
        })
        .then((results) => {
            res.render('classschedule', {
                class_name: results[0].classSchedule.class_name,
                class_schedule: results.map((result) => result.classSchedule),
                name: req.session.name,
                counts: results.map((result) => result.count)
            });
        })
        .catch((err) => {
            console.log(err);
            res.sendStatus(500);
        });

        // dbConnection.execute('SELECT * FROM exerciseclass,exerciseclassschedule where exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id =?',[req.query.t_id])
        // .then(([rows])=>{
            
        //     res.render('classschedule',{
        //         class_name:rows[0].class_name,
        //         class_schedule:rows,
        //         name:req.session.name
        //     })
        // })
   }else if(req.query.t_book_id){
        dbConnection.execute('SELECT *  FROM exerciseclassschedule,exerciseclass WHERE exerciseclassschedule.class_id = exerciseclass.class_id and exerciseclassschedule.classschedule_id =?',[req.query.t_book_id])
        .then(row=>{
            res.render('classbooking',{
                class_booking:row,
                name:req.session.name
            })
        })
   }else{
    dbConnection.execute('SELECT class_id,class_name,type_id,type_name FROM exerciseclass,classtype where exerciseclass.classtype_id = classtype.type_id')
    .then(row=>{
        res.render('classsearch',{
            list:row[0],
            name:req.session.name
        })
    })
}
})


app.post('/addbook',ifNotLoggedin,(req,res,next)=>{
    const validation_result = validationResult(req);
    

    if(validation_result.isEmpty()){



        if(req.body.classbooking){
            const booking = req.body.classbooking;
            if(req.session.class_booking_id){
            
                var count = 0;
                req.session.class_booking_id.forEach(data=>{
                    if(data == booking){
                        count++;
                    }
                });
    
                if(count == 0){
                    req.session.class_booking_id.push(booking);
                }
                // console.log( req.session.booking_id);
                // console.log( req.session.booking_date);
                res.render('check');
                }else{
                req.session.class_booking_id = [];
                req.session.class_booking_id.push(booking);
                // console.log( req.session.booking_id);
                // console.log( req.session.booking_date);
    
                res.render('check');
                }
        }else if(req.body.booking){
            const booking = req.body.booking;
            if(req.session.booking_id){
            
            var count = 0;
            req.session.booking_id.forEach(data=>{
                if(data == booking){
                    count++;
                }
            });

            if(count == 0){
                req.session.booking_id.push(booking);
            }
            // console.log( req.session.booking_id);
            // console.log( req.session.booking_date);
            res.render('check');
            }else{
            req.session.booking_id = [];
            req.session.booking_id.push(booking);
            // console.log( req.session.booking_id);
            // console.log( req.session.booking_date);

            res.render('check');
            }
        }
        
    }
});

app.get('/bookinglist',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if (req.session.booking_id && req.session.class_booking_id){
        
        if(req.query.delete_book_id){
            
            const delete_id = req.query.delete_book_id;
            req.session.booking_id = req.session.booking_id.filter((id) => id !== delete_id);
            // console.log(req.session.booking_id);
            

        }
        if(req.query.class_delete_book_id){
            const delete_id = req.query.class_delete_book_id;
            req.session.class_booking_id = req.session.class_booking_id.filter((id) => id !== delete_id);
            // console.log(req.session.booking_id);
        }
        // console.log(req.session.class_booking_id);
        const booklist = [];
        // First promise chain
        const fetchTrainerSchedule = Promise.all(req.session.booking_id.map(data => {
            return dbConnection.execute("SELECT * FROM trainerschedule,trainer where trainer.trainer_id = trainerschedule.trainer_id and  trainerschedule_id = ?",[data])
                .then(rows => {
                    return rows[0];
                });
        }));

        // Second promise chain
        const fetchBookings = Promise.all(req.session.class_booking_id.map(data => {
            return dbConnection.execute("SELECT *  FROM exerciseclassschedule,exerciseclass WHERE exerciseclassschedule.class_id = exerciseclass.class_id and exerciseclassschedule.classschedule_id = ?",[data])
                .then(rows => {
                    return rows[0];
                });
        }));

        // Wait for both promises to resolve
        Promise.all([fetchTrainerSchedule, fetchBookings])
            .then(([trainerSchedule, classSchedule]) => {
                // console.log(classSchedule.length);
                // console.log(trainerSchedule.length);
                res.render('bookList', {
                    booklist: trainerSchedule,
                    classbooking: classSchedule
                });
            })

        .catch(err => {
            console.error(err);
            res.status(500).send("An error occurred");
        });
    }else{
        res.render('bookList',{
            booklist:[],
        })
    }
});

const compare_with_trainer = (one) => {
    var day = [];
    var time = [];
    var f1 = false;
    var f2 = false;
    
    one.forEach((data)=>{
        
        if(day.includes(data[0].trainer_day)){
            f1 = true;
        }else{
            day.push(data[0].trainer_day);
            f1 = false;
        }
        if(time.includes(data[0].trainer_time)){
            f2 = true;
        }else{
            time.push(data[0].trainer_time);
            f2 = false;
        }
        
    })
    // console.log(day);
    // console.log(time);
    
    if(f1==true && f2 == true){
        return true;
    }else{
        return false;
    }
    
}

const date_time = (day_)=>{
    let today = new Date();
    let dayOfWeek = today.getDay();
    let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let day = day_;
    
    let daysUntilTargetDay = (days.indexOf(day) + 7 - dayOfWeek) % 7;
    const current = today.getDate()+daysUntilTargetDay;

    let targetDate = new Date(today.getFullYear(), today.getMonth(),current+1);
    let targetDateString = targetDate.toISOString().slice(0, 10);
    return targetDateString;
}

const compare_with_class = (one) => {
    var day = [];
    var time = [];
    var f1 = false;
    var f2 = false;
    
    one.forEach((data)=>{
        
        if(day.includes(data[0].class_day)){
            f1 = true;
        }else{
            day.push(data[0].class_day);
            f1 = false;
        }
        if(time.includes(data[0].class_time)){
            f2 = true;
        }else{
            time.push(data[0].class_time);
            f2 = false;
        }
        
    })
    // console.log(day);
    // console.log(time);
    
    if(f1==true && f2 == true){
        return true;
    }else{
        return false;
    }
    
}

const compare_with_trainer_class = (one,two) => {
    var f1 = false;
    
    one.forEach((data)=>{
        // console.log(data[0].trainer_day);
        // console.log(data[0].trainer_time);
        two.forEach((data2)=>{
            if(data[0].trainer_day == data2[0].class_day && data[0].trainer_time == data2[0].class_time){
                f1 = true
            }
            // console.log(data2[0].class_day);
            // console.log(data2[0].class_time);
        })    
    })
    return f1;
}

app.get('/confirm_booking',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    const validation_result = validationResult(req);
    if(validation_result.isEmpty()){

        if(req.session.booking_id || req.session.class_booking_id){
            
            const book_trainer = Promise.all(req.session.booking_id.map(data => {
                return dbConnection.execute("SELECT * FROM trainerschedule where trainerschedule_id = ?",[data])
                    .then(rows => {
                        return rows[0];
                    });
            }));
    
            // Second promise chain
            const book_class = Promise.all(req.session.class_booking_id.map(data => {
                return dbConnection.execute("SELECT * FROM exerciseclassschedule where classschedule_id = ?",[data])
                    .then(rows => {
                        return rows[0];
                    });
            }));
            
            const trainer_book = dbConnection.execute("SELECT trainerbooking.trainerschedule_id,trainerbook_date,trainer_time FROM trainerbooking,bookingreceipt,trainerschedule where trainerschedule.trainerschedule_id = trainerbooking.trainerschedule_id and trainerbooking.receipt_id = bookingreceipt.receipt_id  and customer_id =?",[req.session.userID])
            .then(row=>{
                return row[0];
            })

            const class_book = dbConnection.execute("SELECT classbooking.classschedule_id,classbook_date , class_time FROM classbooking,bookingreceipt,exerciseclassschedule where exerciseclassschedule.classschedule_id = classbooking.classschedule_id and classbooking.receipt_id = bookingreceipt.receipt_id  and customer_id = ?",[req.session.userID])
            .then(row=>{
                return row[0];
            })

            // Wait for both promises to resolve
            Promise.all([book_trainer, book_class,trainer_book,class_book])
                .then(([trainer, exerciseclass,trainer_book,class_book]) => {
                    // console.log(classSchedule.length);
                    // console.log(trainerSchedule.length);
                    // console.log(trainer_book);
                    var tr = true;
                    var cl = true;
                    var t_c = true;
                    var t_book_c = true
                    if(trainer.length>0){
                        const trainer_result = compare_with_trainer(trainer);
                        if(trainer_result != false){
                            tr = false;
                        }
                    }
                    if(exerciseclass.length>0){
                        const class_result = compare_with_class(exerciseclass);
                        if(class_result != false){
                            cl = false;
                        }
                    }
                    if(trainer.length>0 && exerciseclass.length>0){
                        const class_trainer_result = compare_with_trainer_class(trainer,exerciseclass);
                        if(class_trainer_result != false){
                            t_c = false;
                        }
                    }

                    const t_date_list = [];
                    const t_date_time = [];
                    if(trainer.length>0){
                        trainer.forEach(data=>{
                            t_date_list.push(date_time(data[0].trainer_day));
                            t_date_time.push(data[0].trainer_time);
                        })

                    }

                    
                    if(exerciseclass.length>0){
                        exerciseclass.forEach(data=>{
                            t_date_list.push(date_time(data[0].class_day));
                            t_date_time.push(data[0].class_time);
                        })

                    }

                    // console.log(class_date_list);

                    const t_book_list = []
                    const t_book_time = [];
                   
                    trainer_book.forEach(data=>{
                        t_book_time.push(data.trainer_time);
                        var j = data.trainerbook_date;
                        var formattedDate = j.toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'});
                        var parts = formattedDate.split('/');
                        var new_formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                        t_book_list.push(new_formattedDate)
                    })
                    // console.log(t_book_time);
                    // console.log(t_book_list);
                    // console.log(t_date_list);

                    
                    
                    class_book.forEach(data=>{
                        t_book_time.push(data.class_time);
                        var j = data.classbook_date;
                        var formattedDate = j.toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'});
                        var parts = formattedDate.split('/');
                        var new_formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                        t_book_list.push(new_formattedDate)
                    })
                    
                    console.log(t_book_list);
                    console.log(t_book_time);
                    

                    console.log("================");
                    console.log(t_date_list);
                    console.log(t_date_time);
                    
                    var result_trainer = true;
                    for (let i = 0; i < t_book_list.length; i++) {
                        for (let j = 0; j < t_date_list.length; j++) {
                            if(t_book_list[i] == t_date_list[j] && t_book_time[i]==t_date_time[j]){
                                result_trainer = false;
                            }
                        }
                    }

                    console.log(result_trainer);
                    

                    // console.log(trainer[0][0].trainer_time);
                    // console.log(exerciseclass[0][0].class_time);
                    if(tr == true && cl == true && t_c == true && result_trainer == true){
                        console.log(tr);
                        console.log(cl);
                        console.log(t_c);
                        res.redirect('/complete');
                    }else{
                        console.log(tr);
                        console.log(cl);
                        console.log(t_c);
                        res.redirect('/bookinglist');
                    }
                })
    
            .catch(err => {
                console.error(err);
                res.status(500).send("An error occurred");
            });
        }

        // if(req.session.booking_id){
        //     const id = req.session.booking_id;
        //     var day = [];
        //     var time = [];
        //     var f1 = false;
        //     var f2 = false;
        //     var count = 0;
        //     id.forEach(data=>{
        //         dbConnection.execute('SELECT * FROM trainerschedule where trainerschedule_id = ?',[data])
        //         .then((rows)=>{
        //             day.forEach(a =>{
        //                 if(a==rows[0][0].trainer_day){
        //                     f1 = true;
        //                 }
        //             });
        //             time.forEach(a =>{
        //                 if(a==rows[0][0].trainer_time){
        //                     f2 = true;
        //                 }
        //             });
        //             if(f1==true && f2 == true){
                        
        //                 res.redirect('/bookinglist');
        //             }else{
        //                 day.push(rows[0][0].trainer_day);
        //                 time.push(rows[0][0].trainer_time);
        //                 count++;
        //                 f1 = false;
        //                 f2 = false;
        //                 if(count == id.length){
        //                     res.redirect('/complete');
        //                 }
        //             }
        //         });
        //     })
        // }
    }
});



const get_current_date_time = ()=>{
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return dateStr; // Output: "2023-02-27 13:45:30"
}



app.get('/complete',ifNotLoggedin,if_it_executive,ifItadmin,(req,res)=>{
   const id = req.session.booking_id;
   const current_date = [];
   const price = [];
   const point = [];
   var count = 0;
   var size = 0;
   var point_recive = 0;
   if(req.session.booking_id || req.session.class_booking_id){
     if(req.session.booking_id.length > 0 && req.session.class_booking_id.length>0){

        const fetchtrainer = Promise.all(req.session.booking_id.map(data => {
            return dbConnection.execute("SELECT * FROM trainerschedule where trainerschedule_id = ?",[data])
                .then(rows => {
                    return Promise.all(rows[0].map(data=>{
                        // console.log(date_time(data.trainer_day));
                        return dbConnection.execute("SELECT * FROM trainerbooking where trainerschedule_id = ? and trainerbook_date = ?",[data.trainerschedule_id,date_time(data.trainer_day)])
                            .then(row=>{
                                // console.log(data);
                                return {trainer_book:row[0][0],
                                        time:date_time(data.trainer_day),
                                        price:data.price,
                                        point:data.point,
                                        add_id:data.trainerschedule_id
                                        };
                            })
                    }));
                });
        }));

        // Second promise chain
        const fetchClass = Promise.all(req.session.class_booking_id.map(data => {
            return dbConnection.execute("SELECT * FROM exerciseclassschedule where classschedule_id = ?",[data])
                .then(rows => {
                    return Promise.all(rows[0].map(data=>{
                        return dbConnection.execute("select count(*) as count from classbooking where classbooking.classschedule_id = ? and classbook_date = ?",[data.classschedule_id,date_time(data.class_day)])
                            .then(row=>{
                                return {
                                    count_row_class: row,
                                    capacity: data.capacity,
                                    time:date_time(data.class_day),
                                    price:data.price,
                                    point:data.point,
                                    caregiver:data.caregiver_id,
                                    add_id:data.classschedule_id
                                };
                            })
                    }))
                });
        }));

        const current_user_id =  dbConnection.execute('SELECT max(receipt_id) as max FROM bookingreceipt')
            .then(id=>{
                var receipt_id = 1;
                receipt_id = id[0][0].max+1;
                return receipt_id;
            })
        

        Promise.all([fetchtrainer, fetchClass,current_user_id])
        .then(([trainerData, classData,current_id]) => {
            // Do something with the results of both promises
            // console.log(trainerData);
            // console.log(classData.length);
            // console.log(classData[0][0].count_row_class[0][0]);
            var can_book_class = true;
            var can_book_trainer = true;
            trainerData.forEach(data=>{
                // console.log(data[0].trainer_book);
                if(typeof data[0].trainer_book === 'undefined'){
                    // console.log('un========');
                    can_book_trainer
                }else{
                    // console.log("ok");
                    can_book_trainer = false;
                }
            });
            classData.forEach(data=>{
                // console.log(data[0].count_row_class[0][0].count);
                // console.log(data[0].capacity)
                if(data[0].count_row_class[0][0].count < data[0].capacity){
                    can_book_class
                }else{
                    can_book_class = false;
                }
            });

            if(can_book_class==true && can_book_trainer==true){
                // dbConnection.execute('SELECT max(receipt_id) as max FROM bookingreceipt')
                // .then(id=>{
                //     var receipt_id = 1;
                //     receipt_id = id[0][0].max+1;
                //     console.log(receipt_id);
                //     trainerData.forEach
                // })
                var date_time = get_current_date_time();
                const insert_book_receipt = dbConnection.execute("INSERT INTO `bookingreceipt` (`payment_date`, `customer_id`) VALUES (?, ?)", [date_time, req.session.userID])
                .then(result => {
                    return result;
                })

            // use insertPromise here, for example:

                insert_book_receipt.then(result => {
                    if(result){

                        const add_trainer_book = Promise.all(trainerData.map(data=>{
                            return dbConnection.execute("INSERT INTO `trainerbooking` (`trainerschedule_id`, `trainerbook_date`, `receipt_id`, `price_payment`, `point_recive`) VALUES (?, ?, ?, ?, ?)",[data[0].add_id,data[0].time,current_id,data[0].price,data[0].point])
                            .then(result_t =>{
                                return result_t;
                            })
                        }))

                        Promise.all([add_trainer_book])
                        .then(result_trainer=>{
                            var count_loop = 0;
                            classData.map(data=>{
                                dbConnection.execute("INSERT INTO `classbooking` (`receipt_id`,`classschedule_id`, `classbook_date`, `caregiver_id`, `price_payment`, `point_recive`) VALUES (?,?, ?, ?, ?, ?)",[current_id,data[0].add_id,data[0].time,data[0].caregiver,data[0].price,data[0].point])
                                .then(result_class=>{
                                    count_loop++;
                                    if(count_loop == classData.length){
                                        var point_recive_book = 0;
                                        trainerData.forEach(data_t=>{
                                            point_recive_book = point_recive_book + data_t[0].point;
                                        })
                                        classData.forEach(data_t=>{
                                            point_recive_book = point_recive_book + data_t[0].point;
                                        })
                                        dbConnection.execute("UPDATE `customer` SET point = point + ? where customer_id = ?",[point_recive_book,req.session.userID])
                                        .then(result_booking_all=>{
                                            if(result_booking_all){
                                                req.session.booking_id = [];
                                                req.session.class_booking_id = [];
                                                res.redirect('/');
                                            }else{
                                                res.redirect('/bookinglist');
                                            }
                                        })
                                            
                                    }
                                })
                            })
                        })




                    }
                }).catch(error => {
                    // handle errors here
                });

                // console.log(current_id);
                // trainerData.forEach(data=>{
                //     console.log(data[0].time);
                //     console.log(data[0].price);
                //     console.log(data[0].point);
                //     console.log(data[0].add_id);
                // });

                // classData.forEach(data=>{
                //     console.log(data[0].caregiver);
                //     console.log(data[0].time);
                //     console.log(data[0].price);
                //     console.log(data[0].point);
                //     console.log(data[0].add_id);
                    
                // })
            }else{
                res.redirect('/bookinglist')
            };

            // console.log(classData);
            // if(classData.length>0){
            //     classData.forEach(data=>{
            //         // console.log(data[0].count_row_class[0]);
            //         // console.log(data[0].capacity)
            //         if(data[0].count_row_class[0][0].count < data[0].capacity){
            //             can_book_class
            //         }else{
            //             can_book_class = false;
            //         }
            //     });
            // }
            // // console.log(trainerData);
            
            // trainerData.forEach(data=>{
            //     // console.log(data[0]);
            //     if(typeof data[0] === 'undefined'){
            //         can_book_trainer
            //     }else{
            //         can_book_trainer = false;
            //     }
            // })
            // // console.log(can_book_trainer);
            // // console.log(can_book_class);

            
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("An error occurred");
        });

        
        // Promise.all([fetchtrainer, fetchClass])
        //     .then(([trainerSchedule, classSchedule]) => {
        //         console.log(classSchedule[0][0].count);
        //         console.log(trainerSchedule[0].length);
        //     })

        // .catch(err => {
        //     console.error(err);
        //     res.status(500).send("An error occurred");
        // });
     }else if(req.session.booking_id.length > 0){
        req.session.booking_id.forEach(data=>{
        dbConnection.execute('SELECT * FROM trainerschedule  where trainerschedule_id = ?',[data])
        .then((rows)=>{
            current_date.push(date_time(rows[0][0].trainer_day));
            price.push(rows[0][0].price);
            point.push(rows[0][0].point);
            point_recive = point_recive+rows[0][0].point;
            // console.log(current_date);
            dbConnection.execute("SELECT * FROM trainerbooking where trainerschedule_id = ? and trainerbook_date = ?",[data,date_time(rows[0][0].trainer_day)])
            .then((row)=>{
                if(row[0][0]){
                    count++;
                }
                size++;
                if(size==id.length){
                    if(count>0){
                        res.redirect('/bookinglist');
                    }else{
                        dbConnection.execute('SELECT max(receipt_id) as max FROM bookingreceipt')
                        .then(userid=>{
                            var receipt_id = 1;
                            receipt_id = userid[0][0].max+1;
                            // console.log(receipt_id);
                            var date_time = get_current_date_time();
                            dbConnection.execute("INSERT INTO `bookingreceipt` (`payment_date`, `customer_id`) VALUES (?, ?)",[date_time,req.session.userID])
                            .then(result =>{
                                if(result){
                                    var index = 0;
                                    var complete = 0;
                                    
                                    id.forEach(insertbooking_id=>{
                                    dbConnection.execute("INSERT INTO `trainerbooking` (`trainerschedule_id`, `trainerbook_date`, `receipt_id`, `price_payment`, `point_recive`) VALUES (?, ?, ?, ?, ?)",[insertbooking_id,current_date[index],receipt_id,price[index],point[index]])
                                    .then(result=>{
                                        if(result){
                                            complete++;
                                            
                                        }

                                        if(complete == id.length ){
                                            dbConnection.execute("UPDATE `customer` SET point = point + ? where customer_id = ?",[point_recive,req.session.userID])
                                            .then(result => {
                                                if(result){
                                                    req.session.booking_id = [];
                                                    res.redirect('/');
                                                }else{
                                                    res.redirect('/bookinglist');
                                                }
                                            })
                                        }
                                        })
                                    })

                                }
                            })

                        })
                    }
                }
            })
        })
    });
     }else if(req.session.class_booking_id.length>0){

        const check_class = Promise.all(req.session.class_booking_id.map(data => {
            return dbConnection.execute("SELECT * FROM exerciseclassschedule where classschedule_id = ?",[data])
                .then(rows => {
                    return rows[0];
                });
        }));

        // Wait for both promises to resolve
        var count = 0;
        var free = true;
        point_recive = 0;
        const price = []
        const point = []
        const id_class = [];
        const bookdate = [];
        const caregiver = [];
        Promise.all([check_class])
            .then(([ check_class]) => {
                check_class.forEach((data)=>{
                    dbConnection.execute('select * from classbooking where classbooking.classschedule_id = ? and classbook_date = ?',[data[0].classschedule_id,date_time(data[0].class_day)])
                    .then(rows=>{
                        count++;
                        price.push(data[0].price);
                        point.push(data[0].point);
                        id_class.push(data[0].classschedule_id); 
                        bookdate.push(date_time(data[0].class_day));
                        caregiver.push(data[0].caregiver_id)
                        point_recive = point_recive + data[0].point;
                        if(data[0].capacity <= rows[0].length){
                            free = false;
                        }
                        // console.log(data[0].classschedule_id)
                        if(count == check_class.length){
                            // console.log(point_recive);
                            if(free){
                                const date_time = get_current_date_time();
                                // console.log(price);
                                // console.log(point);
                                // console.log(id_class);
                                // console.log(bookdate);
                                // console.log(caregiver);
                                
                                dbConnection.execute('SELECT max(receipt_id) as max FROM bookingreceipt')
                                .then(row=>{
                                    var receipt_id = 1;
                                    receipt_id = row[0][0].max+1;
                                dbConnection.execute("INSERT INTO `bookingreceipt` (`payment_date`, `customer_id`) VALUES (?, ?)",[date_time,req.session.userID])
                                .then(result =>{
                                    if(result){
                                        var index_class = -1;
                                        var numinsert = 0;
                                        id_class.forEach((data)=>{
                                            index_class = index_class + 1
                                            dbConnection.execute("INSERT INTO `classbooking` (`receipt_id`,`classschedule_id`, `classbook_date`, `caregiver_id`, `price_payment`, `point_recive`) VALUES (?,?, ?, ?, ?, ?)",[receipt_id,data,bookdate[index_class],caregiver[index_class],price[index_class],point[index_class]])
                                            .then(result=>{
                        
                                                numinsert++;
                                                if(numinsert == id_class.length){
                                                    dbConnection.execute("UPDATE `customer` SET point = point + ? where customer_id = ?",[point_recive,req.session.userID])
                                                    .then(result =>{
                                                        if(result){
                                                            req.session.class_booking_id = [];
                                                            res.redirect('/');
                                                        }else{
                                                            res.redirect('/bookinglist');
                                                        }
                                                    })
                                   
                                                }
                                            })
                                        })
                                    }
                                });
                            })
                            }else{
                                res.redirect('/bookinglist')
                            }
                        }
                    })
                })
            })

        .catch(err => {
            console.error(err);
            res.status(500).send("An error occurred");
        });
     }
   }
//    id.forEach(data=>{
//     dbConnection.execute('SELECT * FROM trainerschedule  where trainerschedule_id = ?',[data])
//     .then((rows)=>{
//         current_date.push(date_time(rows[0][0].trainer_day));
//         price.push(rows[0][0].price);
//         point.push(rows[0][0].point);
//         point_recive = point_recive+rows[0][0].point;
//         // console.log(current_date);
//         dbConnection.execute("SELECT * FROM trainerbooking where trainerschedule_id = ? and trainerbook_date = ?",[data,date_time(rows[0][0].trainer_day)])
//         .then((row)=>{
//             if(row[0][0]){
//                 count++;
//             }
//             size++;
//             if(size==id.length){
//                 if(count>0){
//                     res.redirect('/bookinglist');
//                 }else{
//                     dbConnection.execute('SELECT max(receipt_id) as max FROM bookingreceipt')
//                     .then(userid=>{
//                         var receipt_id = 1;
//                         receipt_id = userid[0][0].max+1;
//                         // console.log(receipt_id);
//                         var date_time = get_current_date_time();
//                         dbConnection.execute("INSERT INTO `bookingreceipt` (`payment_date`, `customer_id`) VALUES (?, ?)",[date_time,req.session.userID])
//                         .then(result =>{
//                             if(result){
//                                 var index = 0;
//                                 var complete = 0;
                                
//                                 id.forEach(insertbooking_id=>{
//                                 dbConnection.execute("INSERT INTO `trainerbooking` (`trainerschedule_id`, `trainerbook_date`, `receipt_id`, `price_payment`, `point_recive`) VALUES (?, ?, ?, ?, ?)",[insertbooking_id,current_date[index],receipt_id,price[index],point[index]])
//                                 .then(result=>{
//                                     if(result){
//                                         complete++;
                                        
//                                     }

//                                     if(complete == id.length ){
//                                         dbConnection.execute("UPDATE `customer` SET point = point + ? where customer_id = ?",[point_recive,req.session.userID])
//                                         .then(result => {
//                                             if(result){
//                                                 req.session.booking_id = null;
//                                                 res.redirect('/');
//                                             }else{
//                                                 res.redirect('/bookinglist');
//                                             }
//                                         })
//                                     }
//                                     })
//                                 })

//                             }
//                         })

//                     })
//                 }
//             }
//         })
//     })
//    });

});       

app.get('/schedule',ifNotLoggedin , ifItadmin ,if_it_executive,(req,res)=>{
    console.log(get_current_date());
    dbConnection.execute('SELECT trainer.trainer_id ,trainer_name , trainer_day , trainer_time FROM trainerbooking,bookingreceipt,trainerschedule , trainer WHERE WEEK(trainerbook_date) = WEEK(?) and bookingreceipt.receipt_id = trainerbooking.receipt_id  and trainerbooking.trainerschedule_id = trainerschedule.trainerschedule_id and trainer.trainer_id = trainerschedule.trainer_id and customer_id = ?',[get_current_date(),req.session.userID])
    .then((rows)=>{
        dbConnection.execute('SELECT exerciseclass.class_id ,class_name , class_day , class_time FROM classbooking,bookingreceipt,exerciseclassschedule , exerciseclass WHERE WEEK(classbook_date) = WEEK(?) and bookingreceipt.receipt_id = classbooking.receipt_id  and classbooking.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and customer_id = ?',[get_current_date(),req.session.userID])
        .then(row=>{
            res.render('schedule',{
                schedule_list:rows[0],
                class_list:row[0]
            })
        })
    })
    
})

app.get('/trainer-info',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_id){
        dbConnection.execute("SELECT * , DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender FROM trainer WHERE trainer_id = ?",[req.query.t_id])
        .then((row)=>{
            res.render('trainerinfo',{
                trainer:row[0]
            })
        })
    }
})

app.get('/class-info',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_id){
        dbConnection.execute("SELECT * FROM exerciseclass,classtype WHERE exerciseclass.classtype_id = classtype.type_id and class_id = ?",[req.query.t_id])
        .then((row)=>{
            res.render('classinfo',{
                class_info:row[0],
                name:req.session.name
            })
        })
    }
})

app.get('/report',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    res.render('report');
})

app.get('/report/trainerbooking',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT trainer_id , trainer_name FROM trainer';
    if(req.query.t_gender == 'm'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'm' ";
    }else if(req.query.t_gender == 'f'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'f' ";
    }
    dbConnection.execute(sql)
    .then((row)=>{
        const t_list = row[0].map(data => data.trainer_id);
        const t_name_list = row[0].map(data => data.trainer_name);
        var sql2 = "SELECT count(*) as Bookingcount FROM trainerbooking,trainerschedule,trainer WHERE trainerbooking.trainerschedule_id = trainerschedule.trainerschedule_id and trainerschedule.trainer_id = trainer.trainer_id and trainer.trainer_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT count(*) as Bookingcount FROM customer,bookingreceipt,trainerbooking,trainerschedule,trainer WHERE trainerbooking.trainerschedule_id = trainerschedule.trainerschedule_id and trainerschedule.trainer_id = trainer.trainer_id and trainerbooking.receipt_id = bookingreceipt.receipt_id and customer.customer_id = bookingreceipt.customer_id and customer.gender = 'm' and trainer.trainer_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT count(*) as Bookingcount FROM customer,bookingreceipt,trainerbooking,trainerschedule,trainer WHERE trainerbooking.trainerschedule_id = trainerschedule.trainerschedule_id and trainerschedule.trainer_id = trainer.trainer_id and trainerbooking.receipt_id = bookingreceipt.receipt_id and customer.customer_id = bookingreceipt.customer_id and customer.gender = 'f' and trainer.trainer_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(trainerbooking.trainerbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(trainerbooking.trainerbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(trainerbooking.trainerbook_date) = YEAR(CURRENT_DATE()) AND WEEK(trainerbooking.trainerbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(trainerbooking.trainerbook_date) = YEAR(CURRENT_DATE()) AND MONTH(trainerbooking.trainerbook_date) = MONTH(CURRENT_DATE()) AND DAY(trainerbooking.trainerbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and trainerbooking.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and trainerbooking.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and trainerbooking.trainerbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        console.log(sql2)
        const queries = t_list.map(trainer => {
            return dbConnection.execute(sql2,[trainer])
                .then(row => row[0][0].Bookingcount);
        });
        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                res.render('reporttrainerbooking', {
                    trainer_name_list: keys,
                    trainer_count_list: values
                });
            });
    });
});

app.get('/report/classbooking',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT class_id , class_name FROM exerciseclass';
    if(req.query.class_type == 'all'){
        sql = 'SELECT class_id , class_name FROM exerciseclass';
    }else if(req.query.class_type){
        sql = 'SELECT class_id , class_name FROM exerciseclass where classtype_id = '+req.query.class_type;
    }
    dbConnection.execute(sql)
    .then((row)=>{
        const t_list = row[0].map(data => data.class_id);
        const t_name_list = row[0].map(data => data.class_name);
        var sql2 = "SELECT count(*) as Bookingcount FROM classbooking,exerciseclassschedule,exerciseclass WHERE classbooking.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclassschedule.class_id = exerciseclass.class_id and exerciseclass.class_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT count(*) as Bookingcount FROM customer,bookingreceipt,classbooking,exerciseclassschedule,exerciseclass WHERE  classbooking.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclassschedule.class_id = exerciseclass.class_id and classbooking.receipt_id = bookingreceipt.receipt_id and customer.customer_id = bookingreceipt.customer_id and customer.gender = 'm' and exerciseclass.class_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT count(*) as Bookingcount FROM customer,bookingreceipt,classbooking,exerciseclassschedule,exerciseclass WHERE  classbooking.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclassschedule.class_id = exerciseclass.class_id and classbooking.receipt_id = bookingreceipt.receipt_id and customer.customer_id = bookingreceipt.customer_id and customer.gender = 'f' and exerciseclass.class_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(classbooking.classbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(classbooking.classbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(classbooking.classbook_date) = YEAR(CURRENT_DATE()) AND WEEK(classbooking.classbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(classbooking.classbook_date) = YEAR(CURRENT_DATE()) AND MONTH(classbooking.classbook_date) = MONTH(CURRENT_DATE()) AND DAY(classbooking.classbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and classbooking.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and classbooking.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and classbooking.classbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }
        
        console.log(sql2)
        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(row => row[0][0].Bookingcount);
        });
        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                dbConnection.execute('select type_id,type_name from classtype')
                .then(type_class=>{
                    res.render('reportclassbooking', {
                        trainer_name_list: keys,
                        trainer_count_list: values,
                        type_:type_class
                    });
                })
            });
    });
})

app.get('/report/memberreport',ifNotLoggedin,ifNotExecutive,(req,res)=>{

    dbConnection.execute("SELECT type_id , CONCAT(duration, ' ', type_name) AS name FROM membertype")
    .then((row)=>{
        const t_list = row[0].map(data => data.type_id);
        const t_name_list = row[0].map(data => data.name);
        console.log(t_list);
        console.log(t_name_list);
        var sql2 = "SELECT count(*) as membercount FROM membertype,customer WHERE membertype.type_id = customer.type_id and membertype.type_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT count(*) as membercount FROM membertype,customer WHERE membertype.type_id = customer.type_id and customer.gender = 'm' and membertype.type_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT count(*) as membercount FROM membertype,customer WHERE membertype.type_id = customer.type_id and customer.gender = 'f' and membertype.type_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(customer.payment_schedule, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(customer.payment_schedule, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(customer.payment_schedule) = YEAR(CURRENT_DATE()) AND WEEK(customer.payment_schedule) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(customer.payment_schedule) = YEAR(CURRENT_DATE()) AND MONTH(customer.payment_schedule) = MONTH(CURRENT_DATE()) AND DAY(customer.payment_schedule) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and customer.payment_schedule BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and customer.payment_schedule BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and customer.payment_schedule BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        const queries = t_list.map(member => {
            return dbConnection.execute(sql2,[member])
                .then(row => row[0][0].membercount);
        });
        Promise.all(queries)
            .then(t_count => {
                console.log(t_count);
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                res.render('membertypereport', {
                    membertype_name: keys,
                    membertype_count: values
                });
            });
    });
});

app.get('/report/trainer-rating',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT trainer_id , trainer_name FROM trainer';
    if(req.query.t_gender == 'm'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'm' ";
    }else if(req.query.t_gender == 'f'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'f' ";
    }
    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.trainer_id);
        const t_name_list = row[0].map(data => data.trainer_name);
        console.log(t_list);
        console.log(t_name_list);
        var sql2 = "SELECT AVG(rating) AS average_amount FROM trainerrating,trainerschedule where trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and trainer_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT AVG(rating) AS average_amount FROM trainerrating,trainerschedule,customer where customer.customer_id = trainerrating.customer_id and trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and customer.gender = 'm' and trainer_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT AVG(rating) AS average_amount FROM trainerrating,trainerschedule,customer where customer.customer_id = trainerrating.customer_id and trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and customer.gender = 'f' and trainer_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(trainerrating.trainerbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(trainerrating.trainerbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(trainerrating.trainerbook_date) = YEAR(CURRENT_DATE()) AND WEEK(trainerrating.trainerbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(trainerrating.trainerbook_date) = YEAR(CURRENT_DATE()) AND MONTH(trainerrating.trainerbook_date) = MONTH(CURRENT_DATE()) AND DAY(trainerrating.trainerbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        console.log(sql2)
        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(row => row[0][0].average_amount);
        });
        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                res.render('reporttrainerrating', {
                    trainer_name_list: keys,
                    trainer_count_list: values
                });
            });

    })
});

app.get('/report/trainer-rating/trainer-recommend',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT trainer_id , trainer_name FROM trainer';
    if(req.query.t_gender == 'm'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'm' ";
    }else if(req.query.t_gender == 'f'){
        sql = "SELECT trainer_id , trainer_name FROM trainer WHERE gender = 'f' ";
    }
    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.trainer_id);
        const t_name_list = row[0].map(data => data.trainer_name);
        var sql2 = "SELECT feedback FROM trainerrating,trainerschedule where trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and trainer_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT feedback FROM trainerrating,trainerschedule,customer where customer.customer_id = trainerrating.customer_id and trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and customer.gender = 'm' and trainer_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT feedback FROM trainerrating,trainerschedule,customer where customer.customer_id = trainerrating.customer_id and trainerrating.trainerschedule_id = trainerschedule.trainerschedule_id and customer.gender = 'f' and trainer_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(trainerrating.trainerbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(trainerrating.trainerbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(trainerrating.trainerbook_date) = YEAR(CURRENT_DATE()) AND WEEK(trainerrating.trainerbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(trainerrating.trainerbook_date) = YEAR(CURRENT_DATE()) AND MONTH(trainerrating.trainerbook_date) = MONTH(CURRENT_DATE()) AND DAY(trainerrating.trainerbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and trainerrating.trainerbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(rows => {
                    

                    if(rows[0].length == 0){
                        // return [0,0,0,0]
                        // console.log(class_)
                        return [0,0,0,0];
                    }else{
                        var rec_list = []
                        var count_list = [0,0,0,0]
                        var rec_text = [];
                        // console.log(class_)
                        rows[0].forEach(data=>{
                            rec_list.push(data.feedback.slice(1, -1).split(","));
                            // console.log(rec_list)
                        })
                        rec_list.forEach(data_t =>{
                            if(data_t[0]==="1"){
                                count_list[0]++;
                            }
                            if(data_t[1]==="1"){
                                count_list[1]++;
                            }
                            if(data_t[2]==="1"){
                                count_list[2]++;
                            }
                            if(data_t[3]!="0"){
                                rec_text.push(data_t[3]);
                            }
                        })
                        count_list[3] = rec_text;
                        
                        rec_text = []
                        // console.log(rec_list)
                        return count_list;
                        // console.log(count_list);
                    }
                })
        });

        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                
                var index_feedback = 0;
                const feedback_name = ['want to adjust the teaching method','want to teach more detail','inappropriate language','other']
                if(req.query.feed_ === '1'){
                    index_feedback = 0;
                }else if(req.query.feed_ === '2'){
                    index_feedback = 1;
                }else if(req.query.feed_ === '3'){
                    index_feedback = 2;
                }else if(req.query.feed_ === '4'){
                    index_feedback = 3;
                }
                values_one = []
                values.forEach(data=>{
                    values_one.push(data[index_feedback]);
                    
                })
                // console.log(values_one)
                if(req.query.feed_ === '4'){
                    res.render('reporttrainerrecommend_feedback', {
                        trainer_name_list: keys,
                        trainer_count_list: values_one,
                        feedname:feedback_name[index_feedback]
                    });
                }else{
                    res.render('reporttrainerrecommend', {
                        trainer_name_list: keys,
                        trainer_count_list: values_one,
                        feedname:feedback_name[index_feedback]
                    });
                }
            });

    })
})

app.get('/report/class-rating',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT class_id , class_name FROM exerciseclass';
    if(req.query.class_type == 'all'){
        sql = 'SELECT class_id , class_name FROM exerciseclass';
    }else if(req.query.class_type){
        sql = 'SELECT class_id , class_name FROM exerciseclass where classtype_id = '+req.query.class_type;
    }
    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.class_id);
        const t_name_list = row[0].map(data => data.class_name);
        // console.log(t_list);
        // console.log("========================");
        // console.log(t_name_list);
        var sql2 = "SELECT AVG(class_rating) AS class_amount ,AVG(caregiver_rating) AS care_amount  FROM classrating,exerciseclassschedule where classrating.classschedule_id = exerciseclassschedule.classschedule_id and class_id = ?"
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT AVG(class_rating) AS class_amount ,AVG(caregiver_rating) AS care_amount  FROM classrating,exerciseclassschedule,customer where customer.customer_id = classrating.customer_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and customer.gender = 'm' and class_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT AVG(class_rating) AS class_amount ,AVG(caregiver_rating) AS care_amount  FROM classrating,exerciseclassschedule,customer where customer.customer_id = classrating.customer_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and customer.gender = 'f' and class_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND WEEK(classrating.classbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND MONTH(classrating.classbook_date) = MONTH(CURRENT_DATE()) AND DAY(classrating.classbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(row => {
                    return [row[0][0].class_amount , row[0][0].care_amount]
                });
        });

        Promise.all(queries)
            .then((t_count) => {
                const class_count = []
                const care_count = []
                t_count.forEach(data=>{
                    if(data[0]== null){
                        class_count.push(0);
                        
                    }else{
                        class_count.push(parseFloat(data[0]));
                        
                    }
                    if(data[1]== null){
                        care_count.push(0);
                        
                    }else{
                        care_count.push(parseFloat(data[1]));
                        
                    }
                })
                // console.log(class_count)
                // console.log(care_count)
                const care_t_name_list = [];
                t_name_list.forEach(data=>{
                    care_t_name_list.push("caregiver "+data)
                })
                // console.log(care_t_name_list);
               
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, class_count[i]]));
                const dict2 = Object.fromEntries(care_t_name_list.map((name, i) => [name, care_count[i]]));
                // console.log(dict);
                // console.log(dict2);
                const keys = Object.keys(dict);
                const values = Object.values(dict);

                const care_key = Object.keys(dict2);
                const care_values = Object.values(dict2);
                // console.log(values)
                // console.log(care_values)
                // console.log(keys)
                // console.log(care_key)

                // console.log(keys.concat(care_key));
                // console.log(values.concat(care_values));
                var index_a = 0;
                const key_result = [];
                const class_id_a = [];
                keys.forEach(data=>{
                    key_result.push(data);
                    key_result.push(care_key[index_a]);
                    class_id_a.push(t_list[index_a]);
                    class_id_a.push(t_list[index_a]);
                    index_a++;
                })
                // console.log(key_result)

                
                var index_a_value = 0;
                const value_result = [];
                values.forEach(data=>{
                    value_result.push(data);
                    value_result.push(care_values[index_a_value]);
                    index_a_value++;
                })
                // console.log(value_result)
                // console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                // console.log(dict2);
                dbConnection.execute('select type_id,type_name from classtype')
                .then(type_class=>{
                    res.render('reportclassrating', {
                        trainer_name_list: key_result,
                        trainer_count_list: value_result,
                        extend_:class_id_a,
                        type_:type_class
                });
                })
                
        });
    })
});

app.get('/report/class-rating/class-recommend',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id';
    if(req.query.class_type == '1'){
        sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classtype_id = 1';
    }else if(req.query.class_type == '2'){
        sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classtype_id = 2';
    }else if(req.query.class_type == '3'){
        sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classtype_id = 3';
    }else if(req.query.class_type == '4'){
        sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classtype_id = 4';
    }else if(req.query.class_type == '5'){
        sql = 'SELECT distinct exerciseclass.class_id , class_name FROM exerciseclass,exerciseclassschedule,trainer where exerciseclass.class_id = exerciseclassschedule.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classtype_id = 5';
    }
    
    if(req.query.t_gender=='m'){
        sql = sql + " and trainer.gender = 'm' ";
    }else if(req.query.t_gender=='f'){
        sql = sql + " and trainer.gender = 'f' ";
    }

    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.class_id);
        const t_name_list = row[0].map(data => data.class_name);
        var sql2 = "SELECT class_feedback,caregiver_feedback FROM classrating,exerciseclassschedule where classrating.classschedule_id = exerciseclassschedule.classschedule_id and class_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT class_feedback,caregiver_feedback FROM classrating,exerciseclassschedule,customer where customer.customer_id = classrating.customer_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and class_id = ? and customer.gender = 'm'";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT class_feedback,caregiver_feedback FROM classrating,exerciseclassschedule,customer where customer.customer_id = classrating.customer_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and class_id = ? and customer.gender = 'f'";
        }


        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }else if(req.query.date == 'week'){
            sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND WEEK(classrating.classbook_date) = WEEK(CURRENT_DATE())"
        }else if(req.query.date == 'day'){
            sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND MONTH(classrating.classbook_date) = MONTH(CURRENT_DATE()) AND DAY(classrating.classbook_date) = DAY(CURRENT_DATE())"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and classrating.classbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
        }

        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(rows => {
                    // console.log(class_);
                    // console.log(rows[0]);
                    
                    if(rows[0].length ==0){
                        
                        return [[0,0,0,0],[0,0,0,0]];
                    }else{
                        const class_feedback_list = [0,0,0,0];
                        const care_feedback_list = [0,0,0,0];
                        rec_class_list = [];
                        rec_care_list = [];
                        rows[0].forEach(data=>{
                            rec_class_list.push(data.class_feedback.slice(1, -1).split(","));
                            rec_care_list.push(data.caregiver_feedback.slice(1, -1).split(","));
                        })
                        // console.log(rec_class_list);
                        // console.log(rec_care_list);

                        var class_rec_text = [];
                        rec_class_list.forEach(data_t=>{
                            if(data_t[0]==="1"){
                                class_feedback_list[0]++;
                            }
                            if(data_t[1]==="1"){
                                class_feedback_list[1]++;
                            }
                            if(data_t[2]==="1"){
                                class_feedback_list[2]++;
                            }
                            if(data_t[3]!="0"){
                                class_rec_text.push(data_t[3]);
                            }
                        })
                        class_feedback_list[3] = class_rec_text;
                        

                        var care_rec_text = [];
                        rec_care_list.forEach(data_t=>{
                            if(data_t[0]==="1"){
                                care_feedback_list[0]++;
                            }
                            if(data_t[1]==="1"){
                                care_feedback_list[1]++;
                            }
                            if(data_t[2]==="1"){
                                care_feedback_list[2]++;
                            }
                            if(data_t[3]!="0"){
                                care_rec_text.push(data_t[3]);
                            }
                        })
                        care_feedback_list[3] = care_rec_text;
                        // console.log(class_feedback_list)
                        // console.log(care_feedback_list)
                        
                        return [class_feedback_list,care_feedback_list];
                        
                    }
                })
        });

        Promise.all(queries)
            .then(t_count => {
                
                const class_rec_list = [];
                const care_rec_list = [];
                t_count.forEach(data=>{
                    class_rec_list.push(data[0]);
                    care_rec_list.push(data[1]);
                })
                const care_name_list = []
                t_name_list.forEach(data=>{
                    care_name_list.push("caregiver "+data);
                });
                
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, class_rec_list[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);

                const dict_care = Object.fromEntries(care_name_list.map((name, i) => [name, care_rec_list[i]]));
                const keys_care = Object.keys(dict_care);
                const values_care = Object.values(dict_care);

                // console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                // console.log(dict_care);

                // console.log(result_keys);
                // console.log(result_value)
                
                var class_index_feedback = 0;
                const class_feedback_name = ['Wish the class had more capacity','want to change the location of the class','Too little of what is taught in class','other'];
                const care_feedback_name = ['want to adjust the teaching method','want to teach more detail','inappropriate language','other'];
                if(req.query.class_feed_ === '1'){
                    class_index_feedback = 0;
                }else if(req.query.class_feed_ === '2'){
                    class_index_feedback = 1;
                }else if(req.query.class_feed_ === '3'){
                    class_index_feedback = 2;
                }else if(req.query.feed_ === '4'){
                    class_index_feedback = 3;
                }
                var care_index_feedback = 0;
                if(req.query.care_feed_ === '1'){
                    care_index_feedback = 0;
                }else if(req.query.care_feed_ === '2'){
                    care_index_feedback = 1;
                }else if(req.query.care_feed_ === '3'){
                    care_index_feedback = 2;
                }else if(req.query.feed_ === '4'){
                    care_index_feedback = 3;
                }
                class_values_one = []
                values.forEach(data=>{
                    class_values_one.push(data[class_index_feedback]);
                    
                });

                care_values_one = []
                values_care.forEach(data=>{
                    care_values_one.push(data[care_index_feedback]);
                    
                });

                // console.log(class_values_one);
                // console.log(care_values_one);

                const result_keys = [];
                var index_key = 0;
                const class_id_a = [];
                keys.forEach(data=>{
                    result_keys.push(data);
                    result_keys.push(keys_care[index_key]);
                    class_id_a.push(t_list[index_key]);
                    class_id_a.push(t_list[index_key]);
                    index_key++;
                });

                

                const result_value = [];
                var index_value = 0;
                class_values_one.forEach(data=>{
                    result_value.push(data);
                    result_value.push(care_values_one[index_value]);
                    index_value++;
                });

                // console.log(result_keys);
                // console.log(result_value);

                // console.log(values_one)

                if(req.query.feed_ === '4'){
                    console.log(result_keys);
                    console.log(result_value);
                    res.render('reportclassrecommend_feedback', {
                        trainer_name_list: result_keys,
                        trainer_count_list: result_value,
                        feedname:"other"
                    });
                }else{
                    res.render('reportclassrecommend', {
                        trainer_name_list: result_keys,
                        trainer_count_list: result_value,
                        class_feedname:class_feedback_name[class_index_feedback],
                        care_feedname:care_feedback_name[care_index_feedback],
                        extend_:class_id_a
                    });
                }
            });

    })
});

app.get('/report/class-rating/detail',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    if(req.query.t_id){
        var sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ?";
        if(req.query.t_gender=='m'){
            sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ? and trainer.gender = 'm'";
        }else if(req.query.t_gender=='f'){
            sql = sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ? and trainer.gender = 'f'"
        }
        dbConnection.execute(sql,[req.query.t_id])
        .then(row=>{
            const t_list = row[0].map(data => data.caregiver_id);
            const t_name_list = row[0].map(data => data.trainer_name);
            const class_name = row[0].map(data => data.class_name);
            // console.log(t_list);
            // console.log(t_name_list);
            
            var sql2 = "SELECT AVG(caregiver_rating) AS average_amount FROM classbooking,classrating,exerciseclassschedule,exerciseclass,trainer WHERE trainer.trainer_id = classbooking.caregiver_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = ? and classbooking.caregiver_id = ?";
            if(req.query.cus_gender == 'm'){
                sql2 = "SELECT AVG(caregiver_rating) AS average_amount FROM classbooking,classrating,exerciseclassschedule,exerciseclass,trainer,customer WHERE customer.customer_id = classrating.customer_id and trainer.trainer_id = classbooking.caregiver_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = ? and classbooking.caregiver_id = ? and customer.gender = 'm'";
            }else if(req.query.cus_gender == 'f'){
                sql2 = "SELECT AVG(caregiver_rating) AS average_amount FROM classbooking,classrating,exerciseclassschedule,exerciseclass,trainer,customer WHERE customer.customer_id = classrating.customer_id and trainer.trainer_id = classbooking.caregiver_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = ? and classbooking.caregiver_id = ? and customer.gender = 'f'";
            }
    
            if(req.query.date == 'year'){
                sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
            }else if(req.query.date == 'month'){
                sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
            }else if(req.query.date == 'week'){
                sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND WEEK(classrating.classbook_date) = WEEK(CURRENT_DATE())"
            }else if(req.query.date == 'day'){
                sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND MONTH(classrating.classbook_date) = MONTH(CURRENT_DATE()) AND DAY(classrating.classbook_date) = DAY(CURRENT_DATE())"
            }
    
            if(req.query.mindate && req.query.maxdate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
            }else if(req.query.mindate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
            }else if(req.query.maxdate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
            }

            console.log(sql2)
            const queries = t_list.map(class_ => {
                return dbConnection.execute(sql2,[req.query.t_id,class_])
                    .then(row => {
                        return row[0][0].average_amount;
                    });
            });
            
            Promise.all(queries)
                .then(t_count => {
                    console.log(t_count);
                    const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                    const keys = Object.keys(dict);
                    const values = Object.values(dict);
                    // console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                    
                    res.render('reportcaregiverrating', {
                        trainer_name_list: keys,
                        trainer_count_list: values,
                        class_name:class_name[0],
                        care_id_:req.query.t_id
                    });
                });
    
        })
    }else{
        res.redirect('/report/class-rating');
    }
})

app.get('/report/class-rating/class-recommend/detail',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    if(req.query.t_id){
        var sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ?";
        if(req.query.t_gender=='m'){
            sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ? and trainer.gender = 'm'";
        }else if(req.query.t_gender=='f'){
            sql = sql = "SELECT DISTINCT  class_name,classbooking.caregiver_id,trainer_name FROM trainer,classrating,classbooking,exerciseclassschedule,exerciseclass WHERE trainer.trainer_id = classbooking.caregiver_id and classrating.classschedule_id = classbooking.classschedule_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclass.class_id = ? and trainer.gender = 'f'"
        }
        dbConnection.execute(sql,[req.query.t_id])
        .then(row=>{
            const t_list = row[0].map(data => data.caregiver_id);
            const t_name_list = row[0].map(data => data.trainer_name);
            const class_name = row[0].map(data => data.class_name);

            // console.log(t_name_list);

            var sql2 = "SELECT caregiver_feedback FROM classrating ,exerciseclassschedule,trainer,exerciseclass where exerciseclassschedule.class_id = exerciseclass.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclass.class_id = ? and trainer_id = ?";
            if(req.query.cus_gender == 'm'){
                sql2 = "SELECT caregiver_feedback FROM classrating ,exerciseclassschedule,trainer,exerciseclass,customer where customer.customer_id = classrating.customer_id and exerciseclassschedule.class_id = exerciseclass.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclass.class_id = ? and trainer_id = ? and customer.gender = 'm'";
            }else if(req.query.cus_gender == 'f'){
                sql2 = "SELECT caregiver_feedback FROM classrating ,exerciseclassschedule,trainer,exerciseclass,customer where customer.customer_id = classrating.customer_id and exerciseclassschedule.class_id = exerciseclass.class_id and trainer.trainer_id = exerciseclassschedule.caregiver_id and classrating.classschedule_id = exerciseclassschedule.classschedule_id and exerciseclass.class_id = ? and trainer_id = ? and customer.gender = 'f'";
            }

            if(req.query.date == 'year'){
                sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
            }else if(req.query.date == 'month'){
                sql2 = sql2 + " and DATE_FORMAT(classrating.classbook_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
            }else if(req.query.date == 'week'){
                sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND WEEK(classrating.classbook_date) = WEEK(CURRENT_DATE())"
            }else if(req.query.date == 'day'){
                sql2 = sql2 + " and YEAR(classrating.classbook_date) = YEAR(CURRENT_DATE()) AND MONTH(classrating.classbook_date) = MONTH(CURRENT_DATE()) AND DAY(classrating.classbook_date) = DAY(CURRENT_DATE())"
            }

            if(req.query.mindate && req.query.maxdate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
            }else if(req.query.mindate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '" + req.query.mindate +"' AND '"+get_current_date() +"'";
            }else if(req.query.maxdate){
                sql2 = sql2 + " and classrating.classbook_date BETWEEN '2000-01-01' AND '"+req.query.maxdate +"'";
            }

            // console.log(sql2)
            const queries = t_list.map(trainer_ => {
                return dbConnection.execute(sql2,[req.query.t_id,trainer_])
                    .then(rows => {
                        if(rows[0].length == 0){
                                
                            // console.log("[0,0,0,0]")
                            return [0,0,0,0];
                        }else{
                            var rec_list = []
                            var count_list = [0,0,0,0]
                            var rec_text = [];
                            // console.log(class_)
                            rows[0].forEach(data=>{
                                rec_list.push(data.caregiver_feedback.slice(1, -1).split(","));
                                // console.log(rec_list)
                            })
                            rec_list.forEach(data_t =>{
                                if(data_t[0]==="1"){
                                    count_list[0]++;
                                }
                                if(data_t[1]==="1"){
                                    count_list[1]++;
                                }
                                if(data_t[2]==="1"){
                                    count_list[2]++;
                                }
                                if(data_t[3]!="0"){
                                    rec_text.push(data_t[3]);
                                }
                            })
                            count_list[3] = rec_text;
                            // console.log(count_list);
                            return count_list
                        }
                    });
            });

            Promise.all(queries)
                .then(t_count => {
                    const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                    const keys = Object.keys(dict);
                    const values = Object.values(dict);
                    // console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                    
                    var index_feedback = 0;
                    const feedback_name = ['want to adjust the teaching method','want to teach more detail','inappropriate language','other']
                    if(req.query.feed_ === '1'){
                        index_feedback = 0;
                    }else if(req.query.feed_ === '2'){
                        index_feedback = 1;
                    }else if(req.query.feed_ === '3'){
                        index_feedback = 2;
                    }else if(req.query.feed_ === '4'){
                        index_feedback = 3;
                    }
                    values_one = []
                    values.forEach(data=>{
                        values_one.push(data[index_feedback]);
                        
                    })
                    // console.log(keys)
                    // console.log(values_one)
                    // console.log(values_one)

                    
                    res.render('reportclassrecommenddetail', {
                            trainer_name_list: keys,
                            trainer_count_list: values_one,
                            feedname:feedback_name[index_feedback],
                            class_:class_name[0],
                            class_id_feedback:req.query.t_id
                    });
                    
                });

    })
    }else{
        res.redirect('/report/class-rating/class-recommend')
    }
});

app.get('/rating',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    res.render('reating_select',{
        name:req.session.name
    })
});

app.get('/rating/trainer',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_rating){
        dbConnection.execute("SELECT * ,DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender FROM trainer,trainerschedule,trainerbooking,bookingreceipt where bookingreceipt.receipt_id = trainerbooking.receipt_id and trainerbooking.trainerschedule_id = trainerschedule.trainerschedule_id and trainer.trainer_id = trainerschedule.trainer_id and trainerschedule.trainerschedule_id =? and bookingreceipt.customer_id = ?",[req.query.t_rating,req.session.userID])
        .then(row=>{
            // console.log(row[0])
            res.render('trainer_rate_raccomend',{
                name:req.session.name,
                trainer:row[0]
            })
        });
    }else{
        const trainer_book_history = dbConnection.execute(
            "SELECT * FROM trainer, trainerschedule, trainerbooking, bookingreceipt, customer WHERE trainer.trainer_id = trainerschedule.trainer_id AND trainerschedule.trainerschedule_id = trainerbooking.trainerschedule_id AND trainerbooking.receipt_id = bookingreceipt.receipt_id AND bookingreceipt.customer_id = customer.customer_id AND customer.customer_id = ?",
            [req.session.userID]
        ).then(rows => {
            return rows[0];
        });
        
        const trainer_rating_history = dbConnection.execute("SELECT * FROM trainerrating where customer_id =?",[req.session.userID])
        .then(rows=>{
            return rows[0];
        })
    
        Promise.all([trainer_book_history, trainer_rating_history])
        .then(results => {
            const trainers = results[0];
            const trainerating = results[1];
            // console.log(trainers.length);
            // console.log(trainerating.length);
            if(trainers.length == 0 && trainerating.length == 0 || trainers.length == 0){
                res.render('trainer_rating',{
                    name:req.session.name,
                    unrated_list:[]
                });
            }else if(trainerating.length == 0){
                res.render('trainer_rating',{
                    name:req.session.name,
                    unrated_list:trainers
                });
            }else{
                const rated_id = [];
                const rated_time = [];
                const unrated_list = [];
                var not_found = true;
                trainers.forEach(data=>{
                    trainerating.forEach(data_r =>{
                        if(data_r.trainerschedule_id === data.trainerschedule_id && data_r.trainerbook_date.getTime() === data.trainerbook_date.getTime()){
                            not_found = false;
                        }
                    });
                    if(not_found){
                        unrated_list.push(data);
                    }
                    not_found = true;
                });
    
                // console.log(unrated_list);
                // console.log('==========')
                // console.log(trainers);
                res.render('trainer_rating',{
                    name:req.session.name,
                    unrated_list:unrated_list
                });
            }
        })
        .catch(error => {
            console.error(error);
        });
    }
    
})



app.post('/complete-rating-trainer',ifNotLoggedin,(req,res)=>{
    const rec = req.body.rec;
    const a_rec = [];
    const check = ['1','2','3',""];
    if(rec.includes('1')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.includes('2')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.includes('3')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.length > 0){
        const l_rec = rec[rec.length-1];
        if(l_rec != '1' && l_rec !='2' && l_rec !='3' && l_rec !=''){
        a_rec.push(l_rec);
        }else{
        a_rec.push(0);
        }
    }else{
        a_rec.push(0);
    }
    // console.log(req.body.trainer_s_id)
    // console.log(req.body.trainer_rating);
    // console.log(a_rec);
    // console.log(req.body.book_date)
    dbConnection.execute("INSERT INTO `trainerrating` (`trainerbook_date`, `trainerschedule_id`, `customer_id`, `rating`, `feedback`) VALUES (?, ?, ?, ?, ?)",[req.body.book_date,req.body.trainer_s_id,req.session.userID,req.body.trainer_rating,a_rec])
    .then(result=>{
        if(result){
            res.redirect('/');
        }else{
            res.redirect('/rating/trainer?t_rating=?',[req.body.trainer_s_id]);
        }
    });
    // check.forEach(data=>{
    //     rec.forEach(data_rec => {
    //         console.log(data);
    //         console.log(data_rec);
    //     })
    // })

    // console.log(a_rec);
    // console.log(req.body.trainer_s_id);
    // dbConnection.execute("INSERT INTO `trainerrating` (`trainerbook_date`, `trainerschedule_id`, `customer_id`, `rating`, `feedback`) VALUES (?, ?, ?, ?, ?)",[])
})

app.get('/rating/class',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_rating){
        dbConnection.execute("SELECT * ,DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender FROM exerciseclass,exerciseclassschedule,classbooking,bookingreceipt,trainer where classbooking.caregiver_id = trainer.trainer_id and exerciseclass.class_id = exerciseclassschedule.class_id and exerciseclassschedule.classschedule_id = classbooking.classschedule_id and classbooking.receipt_id = bookingreceipt.receipt_id and classbooking.classschedule_id=? and bookingreceipt.customer_id = ?",[req.query.t_rating,req.session.userID])
        .then(row=>{
            res.render('class_rate_raccomend',{
                name:req.session.name,
                class_list:row[0]
            })
        })
    }else{
        const class_book_history = dbConnection.execute(
            "SELECT * FROM exerciseclass, exerciseclassschedule, classbooking, bookingreceipt, customer,trainer WHERE exerciseclass.class_id = exerciseclassschedule.class_id AND exerciseclassschedule.classschedule_id = classbooking.classschedule_id AND classbooking.receipt_id = bookingreceipt.receipt_id AND bookingreceipt.customer_id = customer.customer_id AND trainer.trainer_id = classbooking.caregiver_id AND customer.customer_id = ?",
            [req.session.userID]
        ).then(rows => {
            return rows[0];
        });
        
        const class_rating_history = dbConnection.execute("SELECT * FROM fitness.classrating where customer_id = ?",[req.session.userID])
        .then(rows=>{
            return rows[0];
        })
    
        Promise.all([class_book_history, class_rating_history])
        .then(results => {
            const exerciseclass = results[0];
            const classrating = results[1];
            // console.log(exerciseclass.length);
            // console.log(classrating.length);
            if(exerciseclass.length == 0 && classrating.length == 0 || exerciseclass.length == 0){
                res.render('class_rating',{
                    name:req.session.name,
                    unrated_list:[]
                });
            }else if(classrating.length == 0){
                res.render('class_rating',{
                    name:req.session.name,
                    unrated_list:exerciseclass
                });
            }else{
                const rated_id = [];
                const rated_time = [];
                const unrated_list = [];
                var not_found = true;
                exerciseclass.forEach(data=>{
                    classrating.forEach(data_r =>{
                        if(data_r.classschedule_id === data.classschedule_id && data_r.classbook_date.getTime() === data.classbook_date.getTime()){
                            not_found = false;
                        }
                    });
                    if(not_found){
                        unrated_list.push(data);
                    }
                    not_found = true;
                });
    
                // console.log(unrated_list);
                // console.log('==========')
                // console.log(trainers);
                res.render('class_rating',{
                    name:req.session.name,
                    unrated_list:unrated_list
                });
            }
    
    
        })
        .catch(error => {
            console.error(error);
        });
    }
})

const format_feedback = (rec) =>{
    const a_rec = [];
    if(rec.includes('1')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.includes('2')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.includes('3')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.length > 0){
        const l_rec = rec[rec.length-1];
        if(l_rec != '1' && l_rec !='2' && l_rec !='3' && l_rec !=''){
        a_rec.push(l_rec);
        }else{
        a_rec.push(0);
        }
    }else{
        a_rec.push(0);
    }

    return a_rec;
}

app.post('/complete-rating-class',ifNotLoggedin,(req,res)=>{
    // console.log(req.body.class_s_id);
    // console.log(req.body.book_date);
    // console.log(req.body.class_rating);
    // console.log(req.body.class_rec);
    // console.log("===============================");
    // console.log(req.body.trainer_s_id);
    // console.log(req.body.trainer_rating);
    // console.log(req.body.rec);
    // console.log("===============================");
    const class_rec_ = format_feedback(req.body.class_rec);
    const trainer_rec_ = format_feedback(req.body.rec);
    // console.log(class_rec_);
    // console.log(trainer_rec_);
    dbConnection.execute("INSERT INTO `classrating` (`customer_id`, `classschedule_id`, `classbook_date`, `class_rating`, `caregiver_rating`, `class_feedback`, `caregiver_feedback`) VALUES (?, ?, ?, ?, ?, ?, ?)",[req.session.userID,req.body.class_s_id,req.body.book_date,req.body.class_rating,req.body.trainer_rating,class_rec_,trainer_rec_])
    .then(result=>{
        if(result){
            res.redirect('/');
        }else{
            res.redirect('/rating/class?t_rating=?',[req.body.class_s_id]);
        }
    })
})

app.get('/rating/equipment',ifNotLoggedin,ifItadmin,if_it_executive,(req,res)=>{
    if(req.query.t_id ){
        dbConnection.execute("SELECT * FROM equipment,equipmenttype where equipment.type_id = equipmenttype.type_id and equipment_id = ?",[req.query.t_id])
        .then(row=>{
            res.render('equipment_rating_rec',{
                name:req.session.name,
                eq_unrate:row[0]
            })
        })
        
    }else{
        const current_form =dbConnection.execute("SELECT * , DATE_FORMAT(form_date, '%M') AS month_name FROM assessmentform WHERE DATE_FORMAT(form_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')")
        .then(row=>{
            return row[0]
        });

        const equipment_list = dbConnection.execute("SELECT * FROM equipment,equipmenttype where equipment.type_id = equipmenttype.type_id")
        .then(row=>{
            return row[0]
        })

        const rated_equipment = dbConnection.execute("SELECT * FROM assessmentform,assessment WHERE DATE_FORMAT(form_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') and assessmentform.form_id = assessment.form_id and customer_id = ?",[req.session.userID])
        .then(row=>{
            return row[0];
        })

        Promise.all([current_form,equipment_list,rated_equipment])
        .then(result=>{
            const current_form = result[0];
            const equipment = result[1];
            const have_rate = result[2];
            // console.log(result);
            // console.log(current_form.length);
            console.log(equipment);
            console.log(have_rate);
            if(have_rate.length===0){
                res.render('equipment_rating',{
                    name:req.session.name,
                    form_info:current_form,
                    equipment:equipment
                });
            }else{
                const unrated_list = [];
                var not_found = true;
                equipment.forEach(data=>{
                    have_rate.forEach(data_r =>{
                        if(data_r.equipment_id === data.equipment_id ){
                            not_found = false;
                        }
                    });
                    if(not_found){
                        unrated_list.push(data);
                    }
                    not_found = true;
                });
                res.render('equipment_rating',{
                    name:req.session.name,
                    form_info:current_form,
                    equipment:unrated_list
                });
            }
        })
    }
});

const format_feedback_eq = (rec) =>{
    const a_rec = [];
    if(rec.includes('1')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.includes('2')){
        a_rec.push(1);
    }else{
        a_rec.push(0);
    }
    
    if(rec.length > 0){
        const l_rec = rec[rec.length-1];
        if(l_rec != '1' && l_rec !='2' && l_rec !='3' && l_rec !=''){
        a_rec.push(l_rec);
        }else{
        a_rec.push(0);
        }
    }else{
        a_rec.push(0);
    }

    return a_rec;
}

app.post('/complete-rating-equipment',ifNotLoggedin,(req,res)=>{
    // console.log(req.body.eq_r_id);
    // console.log(req.body.eq_rating);
    
    const eq_rec_format = format_feedback_eq(req.body.eq_rec) ;
    // console.log(eq_rec_format);

    dbConnection.execute("SELECT * FROM assessmentform WHERE DATE_FORMAT(form_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')")
    .then(row=>{
        console.log(row[0][0].form_id);
        dbConnection.execute("SELECT * FROM assessment WHERE customer_id = ? and form_id = ?",[req.session.userID,row[0][0].form_id])
        .then(rows=>{
            if(rows[0].length == 0){
                dbConnection.execute("UPDATE `customer` SET point = point + ? where customer_id = ?",[row[0][0].point,req.session.userID])
                .then(result=>{
                    if(result){
                        dbConnection.execute("INSERT INTO `assessment` (`customer_id`, `equipment_id`, `form_id`, `rating`, `feedback`) VALUES (?, ?, ?, ?, ?)",[req.session.userID,req.body.eq_r_id,row[0][0].form_id,req.body.eq_rating,eq_rec_format])
                        .then(result=>{
                            if(result){
                                res.redirect('/rating/equipment');
                            }else{
                                res.redirect('/rating/equipment?t_id = ?',[req.body.eq_r_id]);
                            }
                        })
                    }
                })
            }else{
                dbConnection.execute("INSERT INTO `assessment` (`customer_id`, `equipment_id`, `form_id`, `rating`, `feedback`) VALUES (?, ?, ?, ?, ?)",[req.session.userID,req.body.eq_r_id,row[0][0].form_id,req.body.eq_rating,eq_rec_format])
                .then(result=>{
                    if(result){
                        res.redirect('/rating/equipment');
                    }else{
                        res.redirect('/rating/equipment?t_id = ?',[req.body.eq_r_id]);
                    }
                })
            }
        })
    })
        
})

app.get('/report/equipment',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT equipment_id , equipment_name FROM equipment';
    if(req.query.type_eq == 'all'){
        var sql = 'SELECT equipment_id , equipment_name FROM equipment';
    }else if(req.query.type_eq){
        sql = 'SELECT equipment_id , equipment_name FROM equipment where type_id = '+req.query.type_eq;
    }
    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.equipment_id);
        const t_name_list = row[0].map(data => data.equipment_name);
        console.log(t_list);
        console.log(t_name_list);
        var sql2 = "SELECT avg(rating) as rating_avg FROM assessment,assessmentform where assessmentform.form_id = assessment.form_id and equipment_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT avg(rating) as rating_avg FROM assessment,assessmentform,customer where customer.customer_id = assessment.customer_id and assessmentform.form_id = assessment.form_id and customer.gender = 'm' and equipment_id = ?";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT avg(rating) as rating_avg FROM assessment,assessmentform,customer where customer.customer_id = assessment.customer_id and assessmentform.form_id = assessment.form_id and customer.gender = 'f' and equipment_id = ?";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(assessmentform.form_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(assessmentform.form_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and assessmentform.form_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and assessmentform.form_date > '"+req.query.mindate+"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and assessmentform.form_date < '"+req.query.maxdate+"'";
        }

        // console.log(req.query.mindate)
        // console.log(req.query.maxdate)

        // console.log(sql2)
        const queries = t_list.map(eq_ => {
            return dbConnection.execute(sql2,[eq_])
                .then(rows => {
                    // console.log(eq_)
                    return rows[0][0].rating_avg;
                });
        });
        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                const a_value = [];
                values.forEach(data=>{
                    if(data == null){
                        a_value.push(0);
                    }else{
                        a_value.push(parseFloat(data));
                    }
                });
                // console.log(keys);
                // console.log(a_value);
                dbConnection.execute("select * from equipmenttype")
                .then(type_eq =>{
                    res.render('reportequipmentrating', {
                        trainer_name_list: keys,
                        trainer_count_list: a_value,
                        type_:type_eq
                    });
                })
            });

    })
});

app.get('/report/equipment/equipment-recommend',ifNotLoggedin,ifNotExecutive,(req,res)=>{
    var sql = 'SELECT equipment_id , equipment_name FROM equipment';
    if(req.query.type_eq == 'all'){
        sql = 'SELECT equipment_id , equipment_name FROM equipment';
    }else if(req.query.type_eq){
        sql = 'SELECT equipment_id , equipment_name FROM equipment where type_id = '+req.query.type_eq;
    }
    dbConnection.execute(sql)
    .then(row=>{
        const t_list = row[0].map(data => data.equipment_id);
        const t_name_list = row[0].map(data => data.equipment_name);
        var sql2 = "SELECT feedback  FROM assessment,assessmentform,customer where customer.customer_id = assessment.customer_id and assessmentform.form_id = assessment.form_id and equipment_id = ?";
        if(req.query.cus_gender == 'm'){
            sql2 = "SELECT feedback  FROM assessment,assessmentform,customer where customer.customer_id = assessment.customer_id and assessmentform.form_id = assessment.form_id and equipment_id = ? and customer.gender = 'm'";
        }else if(req.query.cus_gender == 'f'){
            sql2 = "SELECT feedback  FROM assessment,assessmentform,customer where customer.customer_id = assessment.customer_id and assessmentform.form_id = assessment.form_id and equipment_id = ? and customer.gender = 'f'";
        }

        if(req.query.date == 'year'){
            sql2 = sql2 + " and DATE_FORMAT(assessmentform.form_date, '%Y-%m-%d') = YEAR(CURRENT_DATE())"
        }else if(req.query.date == 'month'){
            sql2 = sql2 + " and DATE_FORMAT(assessmentform.form_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
        }

        if(req.query.mindate && req.query.maxdate){
            sql2 = sql2 + " and assessmentform.form_date BETWEEN '" + req.query.mindate +"' AND '"+req.query.maxdate +"'";
        }else if(req.query.mindate){
            sql2 = sql2 + " and assessmentform.form_date > '"+req.query.mindate+"'";
        }else if(req.query.maxdate){
            sql2 = sql2 + " and assessmentform.form_date < '"+req.query.maxdate+"'";
        }

        
        const queries = t_list.map(class_ => {
            return dbConnection.execute(sql2,[class_])
                .then(rows => {
                    // console.log(class_)
                    // console.log(rows[0])
                    if(rows[0].length == 0){
                        
                        // console.log("[0,0,0]")
                        return [0,0,0,0];
                    }else{
                        var rec_list = []
                        var count_list = [0,0,0]
                        var rec_text = [];
                        
                        rows[0].forEach(data=>{
                            rec_list.push(data.feedback.slice(1, -1).split(","));
                            // console.log(rec_list)
                        })
                        rec_list.forEach(data_t =>{
                            if(data_t[0]==="1"){
                                count_list[0]++;
                            }
                            if(data_t[1]==="1"){
                                count_list[1]++;
                            }
                            if(data_t[2]!="0"){
                                rec_text.push(data_t[2]);
                            }
                            
                        })
                        count_list[2] = rec_text;
                        
                        rec_text = []
                        // console.log(rec_list)
                        return count_list;
                        // console.log(count_list);
                    }
                })
        });

        Promise.all(queries)
            .then(t_count => {
                const dict = Object.fromEntries(t_name_list.map((name, i) => [name, t_count[i]]));
                const keys = Object.keys(dict);
                const values = Object.values(dict);
                console.log(dict); // Output: { John: 6, Mary: 0, Peter: 0, Jane: 0 }
                
                var index_feedback = 0;
                const feedback_name = ['Need more working examples','There are too few exercise equipment, need more','other']
                if(req.query.feed_ === '1'){
                    index_feedback = 0;
                }else if(req.query.feed_ === '2'){
                    index_feedback = 1;
                }else if(req.query.feed_ === '3'){
                    index_feedback = 2;
                }
                values_one = []
                values.forEach(data=>{
                    values_one.push(data[index_feedback]);
                    
                })
                // console.log(values_one)
                dbConnection.execute("select * from equipmenttype")
                .then(type_eq =>{
                    if(req.query.feed_ === '3'){
                        res.render('reportequipmentrecommend_feedback', {
                            trainer_name_list: keys,
                            trainer_count_list: values_one,
                            feedname:feedback_name[index_feedback],
                            type_:type_eq
                        });
                    }else{
                        res.render('reportrequipmentrecommend', {
                            trainer_name_list: keys,
                            trainer_count_list: values_one,
                            feedname:feedback_name[index_feedback],
                            type_:type_eq
                        });
                    }
                })
            });

    })
});

app.get('/profile', ifNotLoggedin,ifItadmin,if_executive, (req,res) => {
    // res.render('profile')
    dbConnection.execute("SELECT *, DATE_FORMAT(FROM_DAYS(DATEDIFF(NOW(), date_of_birth)), '%Y') + 0 AS age , CASE gender WHEN 'm' THEN 'male' WHEN 'f' THEN 'female' END as full_gender  FROM `customer` WHERE `customer_id`=?",[req.session.userID])
    .then(([rows]) => {
        req.session.name = rows[0].customer_name;
        req.session.email = rows[0].email;
        req.session.gender = rows[0].gender;
        req.session.date_of_birth = rows[0].date_of_birth;
        req.session.payment_schedule = rows[0].payment_schedule;

        res.render('profile',{
            name:rows[0].customer_name,
            email:rows[0].email,
            gender:rows[0].full_gender,
            age:rows[0].age,
            date_of_birth:rows[0].date_of_birth,
            payment_schedule:rows[0].payment_schedule,
            point_account:rows[0].point

        });
        
    });
});

app.get('/edit-profile', (req,res) => {
    dbConnection.execute("SELECT `customer_name` ,`email`, `gender`, `date_of_birth`, `payment_schedule`  FROM `customer` WHERE `customer_id`=?",[req.session.userID])
    .then(([rows]) => {
        res.render('editprofile',{
            name:rows[0].customer_name,
            email:rows[0].email,
            gender:rows[0].gender,
        });
    });
});

app.post('/edit-profile', (req,res) => {
    const { name, email, gender } = req.body;

    dbConnection.execute("UPDATE `customer` SET `customer_name`=?, `email`=?, `gender`=? WHERE `customer_id`=?",[
        name,
        email,
        gender,
        req.session.userID
    ])
    .then(() => {
        req.session.name = name;
        req.session.email = email;
        req.session.gender = gender;

        res.redirect('/profile');
    });
});


app.get('/createform',ifNotLoggedin,ifNotadmin,(req,res)=>{
    const current_date = get_current_date();
    const dateObj = new Date(current_date);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    
    dbConnection.execute("SELECT * FROM assessmentform WHERE MONTH(form_date) = MONTH(?)",[current_date])
    .then(row=>{
        if(row[0].length>0){
            res.render('alreadyhaveform',{
                name:req.session.name
            })
        }else{
            res.render('addform',{
                name:req.session.name,
                m_name:monthName
            })
        }
    })
});


app.post('/createform',ifNotLoggedin,(req,res)=>{
    const current_date = get_current_date();
    const dateObj = new Date(current_date);
    dateObj.setDate(1); // Set the date to the first day of the month
    const beginningOfMonth = dateObj.toISOString().slice(0,10);

    dbConnection.execute("INSERT INTO `assessmentform` (`form_date`, `point`) VALUES (?, ?)",[beginningOfMonth,req.body.point])
    .then(result=>{
        if(result){
            res.redirect('/');
        }else{
            res.redirect('/createform');
        }
    })
});



app.use('/', (req,res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});



app.listen(3000, () => console.log("Server is Running..."));






