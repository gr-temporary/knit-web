#include <cheerp/client.h>
#include <cheerp/clientlib.h>

using namespace client;

// The class can of course have any name
// The [[jsexport]] attribute tells Cheerp to make
// the class available to JavaScript code
class [[cheerp::jsexport]] JsBridge
{
private:
    // The class is allowed to have member variables
    // but they should all be trivially destructible
    int callCount;
public:
    JsBridge():callCount(0)
    {
    }
    int addAndReturn(int a)
    {
        console.log("Called C++ code");
        callCount+=a;
        return callCount;
    }
};

// An entry point, even if empty, is still required
void webMain()
{
}