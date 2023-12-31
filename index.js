const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;


// Middleware 
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  //  bearer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })

}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.hmqqjse.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("SummerCampDB").collection("Users");
    const addClassCollection = client.db("SummerCampDB").collection("addClasses");
    const selectedClassCollection = client.db("SummerCampDB").collection("selectedClass");
    const paymentClassCollection = client.db("SummerCampDB").collection("payments");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // Verify Student Middleware -------> New Code
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'student') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }

    // Verify Admin Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }

    // Verify instructor Middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }


    // Users Related API
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    // GET All Users
    app.get('/allUsers', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // Get current user
    app.get('/currentUser/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ error: true, message: 'User not found' });
      }
      res.send(user);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User Already Exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })


    // GET Instructors
    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const result = await usersCollection.find(query).toArray();
      console.log(query)
      res.send(result);
    });


    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })


    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })


    
    app.get('/users/students/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === 'student' }
      res.send(result);
    })


    // GET Add Classes
    app.get('/manageClasses', verifyJWT, verifyAdmin, async (req, res) => {
      const classes = await addClassCollection.find().toArray();
      res.send(classes);
    });

    // GET Single Instructor Classes
    app.get('/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const classes = await addClassCollection.find(query).toArray();
      res.send(classes);
    });

    // All Approved Classes
    app.get('/approvedClasses', async (req, res) => {
      const query = { status: 'approved' };
      const classes = await addClassCollection.find(query).toArray();
      res.send(classes);
    });

    // GET Selected Classes
    app.get('/selectedClass', async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const selectedClasses = await selectedClassCollection.find(query).toArray();
      res.send(selectedClasses);
    });
    // GET Selected Class By Id
    app.get('/selectedClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const selectedClass = await selectedClassCollection.findOne(filter);
      res.send(selectedClass)
    });

    // PopularClasses
    app.get('/popularClasses', async (req, res) => {
      const minEnrollment = 3;
      const query = { enrollmentStudent: { $gte: minEnrollment } };
      const popularClasses = await addClassCollection.find(query).toArray();

      res.send(popularClasses);
    });
    // Popular Instructors
    app.get('/popularInstructors', async (req, res) => {
      const minEnrollment = 3;

      const query = { totalEnrolmentStudent: { $gte: minEnrollment } };
      const popularInstructors = await usersCollection.find(query).toArray();

      res.send(popularInstructors);
    });

    // GET Admin stats
    app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {

      const usersCount = await usersCollection.estimatedDocumentCount();
      const instructorsCount = await usersCollection.countDocuments({ role: 'instructor' });
      const addClassesCount = await addClassCollection.estimatedDocumentCount();
      const selectedClassesCount = await selectedClassCollection.estimatedDocumentCount();
      const paymentCount = await paymentClassCollection.estimatedDocumentCount();
      const approvedClassesCount = await addClassCollection.countDocuments({ status: 'approved' });

      const adminStats = {
        usersCount,
        instructorsCount,
        addClassesCount,
        selectedClassesCount,
        approvedClassesCount,
        paymentCount
      };

      res.send(adminStats);

    });
    // GET Instructors

    app.get('/instructor-stats/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;

      // Get Instructor approved class
      const instructorAddedClassesCount = await addClassCollection.countDocuments({ instructorEmail: email });
      const approvedClassesCount = await addClassCollection.countDocuments({
        instructorEmail: email,
        status: 'approved'
      });
      const pendingClassesCount = await addClassCollection.countDocuments({
        instructorEmail: email,
        status: 'pending'
      });
      const deniedClassesCount = await addClassCollection.countDocuments({
        instructorEmail: email,
        status: 'denied'
      });

      const instructorStats = {
        instructorAddedClassesCount,
        approvedClassesCount,
        pendingClassesCount,
        deniedClassesCount
      };

      res.send(instructorStats);
    });

    // GET Student Stats
    app.get('/student-stats/:email', verifyJWT, verifyStudent, async (req, res) => {
      const email = req.params.email;


      const selectedClassesCount = await selectedClassCollection.countDocuments({
        userEmail: email
      });
      const paymentClassesCount = await paymentClassCollection.countDocuments({
        email: email,
        status: 'Payment Complete'
      });

      const studentsStats = {
        selectedClassesCount,
        paymentClassesCount
      };

      res.send(studentsStats);
    });




    // Add Class
    app.post('/addClass', verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      newClass.status = 'pending';
      const result = await addClassCollection.insertOne(newClass);
      res.send(result);
    })

    // Selected Class
    app.post('/selectedClass', async (req, res) => {
      const selectedClass = req.body;
      const query = {
        selectedClassId: selectedClass.selectedClassId,
        email: selectedClass.email

      };

      const existingSelectedClass = await selectedClassCollection.findOne(query);
      if (existingSelectedClass) {
        return res.send({ message: 'You already selected this class' });
      }

      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });
    // Payment Related Api
    app.post('/payments', verifyJWT, async (req, res) => {
      try {
        const payment = req.body;
        const existingPayment = await paymentClassCollection.findOne({ classId: payment.classId });

        if (existingPayment) {
          return res.send({ message: 'You have already made a payment for this class' });
        }

        const insertResult = await paymentClassCollection.insertOne(payment);

        const classId = payment.classId;
        const selectedClassId = payment.selectedClassId;
        const deleteResult = await selectedClassCollection.deleteOne({ _id: new ObjectId(classId) });

        // Update enrollment status and available seats
        const updateClassResult = await addClassCollection.updateOne(
          {
            _id: new ObjectId(selectedClassId)
          },
          {
            $inc: {
              availableSeats: -1,
              enrollmentStudent: 1
            }
          }
        );

        // Update totalEnrolmentStudent for instructor
        const updateUserResult = await usersCollection.updateOne(
          { email: payment.instructorEmail },
          { $inc: { totalEnrolmentStudent: 1 } }
        );

        res.send({ insertResult, deleteResult, updateClassResult, updateUserResult });
      } catch (error) {
        console.error('Error in processing payment:', error);
        res.status(500).send('Error in processing payment');
      }
    });

    //  GET Payment Api
    app.get('/paymentHistory/:email', verifyJWT, async (req, res) => {
      const { email } = req.params;
      const query = { email: email };
      const paymentHistory = await paymentClassCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();

      res.send(paymentHistory);
    });

    //Instructor Approve Class
    app.patch('/manageClasses/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status } = req.body;
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await addClassCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Classes FeedBack
    app.patch('/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { feedback } = req.body;
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await addClassCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // DELETE Selected Class
    app.delete('/selectedClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(filter);
      res.send(result);
    });

    // DELETE User
    app.delete('/users/:id', verifyJWT, async (req, res) => {
      const userId = req.params.id;

      // Check if the user is the main admin
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (user && user.email === 'developersharif@gmail.com') {
        return res.send({ message: 'This Is Main Admin. You Can Not Delete This User' });
      }

      const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
      res.send(result);
    });




    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Summer Camp Server Is Running');
})





app.listen(port, () => {
  console.log(`Summer Camp Is Running On: ${port}`);
})