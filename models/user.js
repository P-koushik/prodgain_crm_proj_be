import mongoose from "mongoose"

const userSchema = mongoose.Schema({
    uid:{
        type:String,
        required:true,
        unique:true
    },
    name:{
        type:String,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        default:""
    },
    company:{
        type:String,
        default:""
    },
    photoUrl:{
        type:String,
        default:""
    }
}, {
    timestamps: true
})

const User = mongoose.models.User || mongoose.model("User", userSchema)

export default User