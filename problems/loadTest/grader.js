module.exports = function grade(arg, key){
    if(key === "ctfPlatform{my_third_flag}"){
        return [true, "Nice Job!"];
    }else{
        return [false, "Sorry, Incorrect!"];
    }
};
